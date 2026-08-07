import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { ActingUser } from './recruiter-assistant.types';

describe('RecruiterAssistantIntentService', () => {
  const service = new RecruiterAssistantIntentService();
  const admin: ActingUser = {
    id: 'admin-1',
    role: 'admin',
    demo: false,
    email: 'admin@example.com',
    name: 'Admin User',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none',
    hasGoogleAvatar: false,
  };
  const hr: ActingUser = {
    id: 'hr-1',
    role: 'hr',
    demo: false,
    email: 'hr@example.com',
    name: 'HR User',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none',
    hasGoogleAvatar: false,
  };
  const candidate: ActingUser = {
    id: 'candidate-1',
    role: 'candidate',
    demo: false,
    email: 'candidate@example.com',
    name: 'Candidate User',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none',
    hasGoogleAvatar: false,
  };

  it('classifies assign HR requests', () => {
    expect(
      service.classify('assign interview for Alice to Jane', admin, 'en'),
    ).toEqual({
      kind: 'assign_hr',
      interviewRef: { candidateName: 'Alice' },
      hrRef: { name: 'Jane' },
    });
  });

  it('extracts full names from assign HR phrasing', () => {
    expect(
      service.classify(
        'assign the interview for Alice Smith to Jane Doe please',
        admin,
        'en',
      ),
    ).toEqual({
      kind: 'assign_hr',
      interviewRef: { candidateName: 'Alice Smith' },
      hrRef: { name: 'Jane Doe' },
    });
  });

  it('classifies switch locale requests', () => {
    expect(service.classify('switch locale to ru', admin, 'en')).toEqual({
      kind: 'switch_locale',
      requestedLocale: 'ru',
    });
    expect(service.classify('switch locale to klingon', admin, 'en')).toEqual({
      kind: 'switch_locale',
      requestedLocale: null,
      rawToken: 'klingon',
    });
  });

  it('classifies new chat requests', () => {
    expect(service.classify('new chat', admin, 'en')).toEqual({
      kind: 'new_chat',
    });
  });

  it('classifies list interview requests', () => {
    expect(service.classify('show pending interviews', admin, 'en')).toEqual({
      kind: 'list_interviews',
      filters: { limit: 20, status: 'pending' },
    });
  });

  it('classifies create question requests', () => {
    expect(
      service.classify('create a question about React hooks', admin, 'en'),
    ).toEqual({
      kind: 'create_question',
      questionName: 'React hooks',
    });
    expect(service.classify('create a question', admin, 'en')).toEqual({
      kind: 'create_question',
      questionName: undefined,
    });
    expect(
      service.classify('Help me create a new interview question', admin, 'en'),
    ).toEqual({
      kind: 'create_question',
      questionName: undefined,
    });
  });

  it('classifies create interview requests', () => {
    expect(service.classify('create a new interview', admin, 'en')).toEqual({
      kind: 'create_interview',
      candidateName: undefined,
      position: undefined,
    });
    expect(
      service.classify('create interview for Alice for React developer', admin, 'en'),
    ).toEqual({
      kind: 'create_interview',
      candidateName: 'Alice',
      position: 'React Developer',
    });
  });

  it('classifies bulk question prep requests', () => {
    expect(
      service.classify('prepare 5 questions for a React developer', admin, 'en'),
    ).toEqual({
      kind: 'create_questions_interview',
      parsed: expect.objectContaining({
        position: 'React Developer',
        count: 5,
      }),
    });
  });

  it('routes candidate self-status questions separately', () => {
    expect(
      service.classify('what is my interview status', candidate, 'en'),
    ).toEqual({
      kind: 'interview_status',
      ref: {},
      ownInterviews: true,
      scheduleInquiry: false,
    });
  });

  it('flags schedule inquiries for candidate when/where prompts', () => {
    expect(
      service.classify('when is my interview', candidate, 'en'),
    ).toEqual({
      kind: 'interview_status',
      ref: {},
      ownInterviews: true,
      scheduleInquiry: true,
    });
  });

  it('returns out_of_scope for unsupported org summaries', () => {
    expect(
      service.classify(
        'summarize interview activity across the org this month',
        admin,
        'en',
      ),
    ).toEqual({ kind: 'out_of_scope' });
  });

  it('does not treat HR my-interview prompts as candidate self-status', () => {
    expect(service.classify('show my interviews', hr, 'en')).toEqual({
      kind: 'list_interviews',
      filters: { limit: 20, assignedHrId: 'hr-1' },
    });
  });

  it('prefers create over list when both patterns match', () => {
    expect(
      service.classify(
        'generate questions for pending interviews',
        admin,
        'en',
      ).kind,
    ).toBe('create_questions_interview');
  });

  it('does not set status from status substrings inside other words', () => {
    expect(
      service.classify('list interviews depending on role', admin, 'en'),
    ).toEqual({
      kind: 'list_interviews',
      filters: { limit: 20 },
    });
  });

  describe('locale intent routing', () => {
    it.each([
      ['ru', 'покажи все интервью', 'list_interviews'],
      ['ru', 'мой интервью статус', 'interview_status'],
      ['ru', 'назначь интервью для Alice на Jane', 'assign_hr'],
      ['ru', 'статус интервью Alice', 'interview_status'],
      ['ru', 'создай 5 вопросов для React разработчик', 'create_questions_interview'],
      ['en', 'set up an interview for an hr manager role', 'create_questions_interview'],
    ] as const)(
      'classifies %s message "%s" as %s',
      (locale, message, expectedKind) => {
        const intent = service.classify(message, admin, locale);
        expect(intent.kind).toBe(expectedKind);
      },
    );

    it('does not treat bare Russian interview mentions as create', () => {
      expect(service.classify('покажи все интервью', admin, 'ru').kind).toBe(
        'list_interviews',
      );
      expect(
        service.classify('покажи все интервью', admin, 'ru').kind,
      ).not.toBe('create_questions_interview');
    });

    it('does not treat bare English nouns as create', () => {
      expect(service.classify('show pending interviews', admin, 'en').kind).toBe(
        'list_interviews',
      );
      expect(service.classify('what developer tools do we use', admin, 'en').kind).toBe(
        'out_of_scope',
      );
    });
  });
});
