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
    expect(service.classify('cancel', admin, 'en')).toEqual({
      kind: 'new_chat',
    });
    expect(service.classify('abort', admin, 'en')).toEqual({
      kind: 'new_chat',
    });
  });

  it('classifies list interview requests', () => {
    expect(service.classify('show pending interviews', admin, 'en')).toEqual({
      kind: 'list_interviews',
      filters: { limit: 20, status: 'pending' },
    });
  });

  it('classifies question count requests', () => {
    expect(
      service.classify('how many questions do we have in total', admin, 'en'),
    ).toEqual({
      kind: 'count_questions',
      filters: {},
    });
    expect(service.classify('total questions', hr, 'en')).toEqual({
      kind: 'count_questions',
      filters: {},
    });
  });

  it('classifies question count requests with filters', () => {
    expect(
      service.classify('how many hard questions do we have', admin, 'en'),
    ).toEqual({
      kind: 'count_questions',
      filters: { difficulty: 'hard' },
    });
    expect(service.classify('how many react questions', admin, 'en')).toEqual({
      kind: 'count_questions',
      filters: { role: 'React Developer' },
    });
  });

  it('classifies show questions with filters', () => {
    expect(
      service.classify(
        'show hard russian questions in category software-engineering',
        admin,
        'en',
      ),
    ).toEqual({
      kind: 'count_questions',
      filters: {
        difficulty: 'hard',
        category: 'software-engineering',
        locale: 'ru',
      },
    });
  });

  it('does not classify create question as count', () => {
    expect(
      service.classify('create a question about React', admin, 'en').kind,
    ).toBe('create_question');
  });

  it('classifies list assessments requests', () => {
    expect(service.classify('show assessments', admin, 'en')).toEqual({
      kind: 'list_assessments',
      filters: {},
    });
    expect(service.classify('list templates', hr, 'en')).toEqual({
      kind: 'out_of_scope',
    });
  });

  it('classifies list assessments requests with filters', () => {
    expect(service.classify('show react assessments', admin, 'en')).toEqual({
      kind: 'list_assessments',
      filters: { q: 'react' },
    });
    expect(
      service.classify('list assessments with status ready', admin, 'en'),
    ).toEqual({
      kind: 'list_assessments',
      filters: { status: 'ready' },
    });
    expect(
      service.classify(
        'show assessments containing "Senior React"',
        admin,
        'en',
      ),
    ).toEqual({
      kind: 'list_assessments',
      filters: { q: 'Senior React' },
    });
  });

  it('classifies interview activity summary requests', () => {
    expect(
      service.classify('summarize interview activity in my org', admin, 'en'),
    ).toEqual({ kind: 'interview_activity_summary' });
    expect(service.classify('interview activity', hr, 'en')).toEqual({
      kind: 'interview_activity_summary',
    });
  });

  it('classifies list team by role requests', () => {
    expect(service.classify('show all hrs', admin, 'en')).toEqual({
      kind: 'list_team',
      role: 'hr',
      includeSummary: false,
    });
    expect(service.classify('list all admins', admin, 'en')).toEqual({
      kind: 'list_team',
      role: 'admin',
      includeSummary: false,
    });
    expect(
      service.classify('team members with admin role', admin, 'en'),
    ).toEqual({
      kind: 'list_team',
      role: 'admin',
      includeSummary: false,
    });
  });

  it('classifies list team requests', () => {
    expect(service.classify('show my team', admin, 'en')).toEqual({
      kind: 'list_team',
      includeSummary: true,
    });
    expect(service.classify('list team members', admin, 'en')).toEqual({
      kind: 'list_team',
      includeSummary: true,
    });
  });

  it('classifies show HR requests', () => {
    expect(service.classify('show hrs', admin, 'en')).toEqual({
      kind: 'list_hrs',
    });
    expect(service.classify('list hr reviewers', admin, 'en')).toEqual({
      kind: 'list_hrs',
    });
    expect(service.classify('available hr reviewers', admin, 'en')).toEqual({
      kind: 'list_hrs',
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
      service.classify(
        'create interview for Alice for React developer',
        admin,
        'en',
      ),
    ).toEqual({
      kind: 'create_interview',
      candidateName: 'Alice',
      position: 'React Developer',
    });
  });

  it('does not classify English prepare/generate bulk phrasing as create', () => {
    expect(
      service.classify(
        'prepare 5 questions for a React developer',
        admin,
        'en',
      ),
    ).toEqual({ kind: 'out_of_scope' });
    expect(
      service.classify(
        'generate 5 questions for a React developer',
        admin,
        'en',
      ),
    ).toEqual({ kind: 'out_of_scope' });
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
    expect(service.classify('when is my interview', candidate, 'en')).toEqual({
      kind: 'interview_status',
      ref: {},
      ownInterviews: true,
      scheduleInquiry: true,
    });
  });

  it('classifies candidate latest interview status requests', () => {
    expect(
      service.classify(
        'what is the status of my latest interview',
        candidate,
        'en',
      ),
    ).toEqual({
      kind: 'interview_status',
      ref: {},
      ownInterviews: true,
      latest: true,
    });
  });

  it('classifies candidate status by position requests', () => {
    expect(
      service.classify(
        'what is the status of my React Developer interview',
        candidate,
        'en',
      ),
    ).toEqual({
      kind: 'interview_status',
      ref: { position: 'React Developer' },
      ownInterviews: true,
    });
  });

  it('classifies candidate review-by-position requests', () => {
    expect(
      service.classify(
        'did my React Developer interview get reviewed',
        candidate,
        'en',
      ),
    ).toEqual({
      kind: 'review_state',
      ref: { position: 'React Developer' },
    });
  });

  it('classifies candidate new or uncompleted interview list requests', () => {
    expect(
      service.classify('do I have any new interviews', candidate, 'en'),
    ).toEqual({
      kind: 'list_own_interviews',
      activeOnly: true,
    });
    expect(
      service.classify('show my uncompleted interviews', candidate, 'en'),
    ).toEqual({
      kind: 'list_own_interviews',
      activeOnly: true,
    });
  });

  it('does not route candidate active-list prompts to HR list_interviews', () => {
    expect(
      service.classify('show pending interviews', candidate, 'en').kind,
    ).toBe('list_own_interviews');
  });

  it('does not treat HR review prompts as candidate own-review routing', () => {
    expect(service.classify('did Alice get reviewed', admin, 'en')).toEqual({
      kind: 'review_state',
      ref: {},
    });
  });

  it('classifies org activity summary phrasing', () => {
    expect(
      service.classify(
        'summarize interview activity across the org this month',
        admin,
        'en',
      ),
    ).toEqual({ kind: 'interview_activity_summary' });
  });

  it('does not treat HR my-interview prompts as candidate self-status', () => {
    expect(service.classify('show my interviews', hr, 'en')).toEqual({
      kind: 'list_interviews',
      filters: { limit: 20, assignedHrId: 'hr-1' },
    });
  });

  it('prefers list over removed bulk create patterns when both could match', () => {
    expect(
      service.classify(
        'generate questions for pending interviews',
        admin,
        'en',
      ),
    ).toEqual({
      kind: 'list_interviews',
      filters: { limit: 20, status: 'pending' },
    });
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
      [
        'ru',
        'создай 5 вопросов для React разработчик',
        'create_questions_interview',
      ],
      [
        'en',
        'set up an interview for an hr manager role',
        'create_questions_interview',
      ],
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
      expect(
        service.classify('show pending interviews', admin, 'en').kind,
      ).toBe('list_interviews');
      expect(
        service.classify('what developer tools do we use', admin, 'en').kind,
      ).toBe('out_of_scope');
    });
  });
});
