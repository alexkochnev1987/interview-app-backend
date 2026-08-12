import { TemplateService } from '../../template/template.service';
import { AiService } from '../ai.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

describe('RecruiterAssistantToolsService create interview flow', () => {
  const user = {
    id: 'admin-1',
    role: 'admin' as const,
    demo: false,
    email: 'admin@example.com',
    name: 'Admin',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };

  const conversationStore = { update: vi.fn() };
  const pendingActionStore = { issue: vi.fn().mockReturnValue('pending-1') };
  const templateSummary = {
    id: 'template-1',
    name: 'React pack',
    position: 'React Developer',
    questionCount: 1,
    storedQuestionCount: 1,
    demo: false,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const templateService = {
    findAll: vi.fn().mockResolvedValue([templateSummary]),
    findOne: vi.fn().mockResolvedValue({
      ...templateSummary,
      questions: [{ id: 'q-1', questionText: 'Explain React hooks.' }],
    }),
  };

  const service = new RecruiterAssistantToolsService(
    {} as RecruiterQuestionMatcherService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    pendingActionStore as unknown as RecruiterPendingActionStore,
    conversationStore as unknown as RecruiterConversationStore,
    { draftQuestion: vi.fn() } as unknown as AiService,
    templateService as unknown as TemplateService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for candidate name when missing', async () => {
    const response = await service.prepareCreateInterview(
      undefined,
      'React Developer',
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'candidateName',
    });
  });

  it('lists templates when candidate and position are known', async () => {
    const response = await service.prepareCreateInterview(
      'Alice',
      'React Developer',
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
    expect(response.templates).toHaveLength(1);
  });

  it('redirects when no templates match the position', async () => {
    templateService.findAll.mockResolvedValueOnce([]);

    const response = await service.prepareCreateInterview(
      'Alice',
      'React Developer',
      user,
      'en',
      'session-1',
    );

    expect(response.redirect).toEqual({
      path: '/interviews/new',
      query: {
        candidateName: 'Alice',
        position: 'React Developer',
      },
    });
  });

  it('returns confirmation when a template number is chosen', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          candidateName: 'Alice',
          position: 'React Developer',
          templateIds: 'template-1',
          templateChoice: '1',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'needs_confirmation',
      pendingActionId: 'pending-1',
    });
    expect(response.pendingAction).toMatchObject({
      type: 'create_interview',
      candidateName: 'Alice',
      position: 'React Developer',
    });
    expect(templateService.findOne).toHaveBeenCalledWith('template-1', 'en', {
      demo: false,
    });
  });

  it('redirects when the user chooses create my own', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          candidateName: 'Alice',
          position: 'React Developer',
          templateIds: 'template-1',
          templateChoice: 'create my own',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      redirect: {
        path: '/interviews/new',
        query: {
          candidateName: 'Alice',
          position: 'React Developer',
        },
      },
    });
    expect(conversationStore.update).toHaveBeenCalledWith(
      'admin-1',
      'session-1',
      { flow: 'idle', slots: {} },
    );
  });

  it('re-prompts when the template number is out of range', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          candidateName: 'Alice',
          position: 'React Developer',
          templateIds: 'template-1',
          templateChoice: '99',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
    expect(response.templates).toHaveLength(1);
  });
});
