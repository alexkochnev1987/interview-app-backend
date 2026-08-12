import { RecruiterConversationFlowService } from './recruiter-conversation-flow.service';
import { startConversationFlow } from './recruiter-conversation-slots';

describe('RecruiterConversationFlowService', () => {
  const tools = {
    continueAssignHrFlow: vi.fn(),
    continueCreateQuestionFlow: vi.fn(),
    continueCreateQuestionDespiteSimilar: vi.fn(),
    continueCreateInterviewFlow: vi.fn(),
    repromptSimilarQuestionConfirmation: vi.fn(),
  };
  const conversationStore = {
    update: vi.fn(),
  };

  const service = new RecruiterConversationFlowService(
    tools as never,
    conversationStore as never,
  );

  const ctx = {
    user: {
      id: 'user-1',
      role: 'admin' as const,
      demo: false,
      email: 'admin@example.com',
      name: 'Admin',
      createdAt: new Date(),
      avatarSource: 'none' as const,
      hasGoogleAvatar: false,
    },
    locale: 'en' as const,
    sessionId: 'session-1',
    message: 'Jane Doe',
    state: startConversationFlow('assign_hr', 'hr', { interviewRef: 'Alice' }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for idle flow', async () => {
    await expect(
      service.resumeActiveFlow({ ...ctx, state: { flow: 'idle', slots: {} } }),
    ).resolves.toBeNull();
  });

  it('cancels an active flow', async () => {
    const response = await service.resumeActiveFlow({
      ...ctx,
      message: 'cancel',
    });

    expect(conversationStore.update).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      {
        flow: 'idle',
        slots: {},
      },
    );
    expect(response).toEqual({
      status: 'answered',
      response: 'Cancelled. No changes were made.',
    });
  });

  it('delegates to assign HR continuation', async () => {
    tools.continueAssignHrFlow.mockResolvedValue({
      status: 'answered',
      response: 'next',
    });

    const response = await service.resumeActiveFlow(ctx);

    expect(conversationStore.update).toHaveBeenCalled();
    expect(tools.continueAssignHrFlow).toHaveBeenCalled();
    expect(response).toEqual({ status: 'answered', response: 'next' });
  });

  it('continues create question after user confirms despite similar matches', async () => {
    tools.continueCreateQuestionDespiteSimilar.mockResolvedValue({
      status: 'needs_confirmation',
      response:
        'Create question "React hooks" with AI suggestions? Reply yes to confirm.',
    });

    const response = await service.resumeActiveFlow({
      ...ctx,
      message: 'yes create the question anyway',
      state: startConversationFlow(
        'create_question',
        'confirmAddDespiteSimilar',
        {
          questionName: 'React hooks',
        },
      ),
    });

    expect(tools.continueCreateQuestionDespiteSimilar).toHaveBeenCalled();
    expect(tools.continueCreateQuestionFlow).not.toHaveBeenCalled();
    expect(response?.status).toBe('needs_confirmation');
  });

  it('cancels similar-question override from UI cancellation label', async () => {
    const response = await service.resumeActiveFlow({
      ...ctx,
      message: 'no cancel creating the question',
      state: startConversationFlow(
        'create_question',
        'confirmAddDespiteSimilar',
        {
          questionName: 'React hooks',
        },
      ),
    });

    expect(conversationStore.update).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      { flow: 'idle', slots: {} },
    );
    expect(tools.continueCreateQuestionDespiteSimilar).not.toHaveBeenCalled();
    expect(tools.repromptSimilarQuestionConfirmation).not.toHaveBeenCalled();
    expect(response).toEqual({
      status: 'answered',
      response: 'Cancelled. No changes were made.',
    });
  });

  it('reprompts on unclear reply during similar match confirmation', async () => {
    tools.repromptSimilarQuestionConfirmation.mockResolvedValue({
      status: 'answered',
      response: 'Reply yes to add the question anyway, or no/cancel to abort.',
      awaitingInput: 'confirmAddDespiteSimilar',
      similarQuestions: [
        {
          id: 'q1',
          questionText: 'Explain React hooks.',
          score: 0.9,
          href: '/questions/q1',
        },
      ],
    });

    const response = await service.resumeActiveFlow({
      ...ctx,
      message: 'maybe',
      state: startConversationFlow(
        'create_question',
        'confirmAddDespiteSimilar',
        {
          questionName: 'React hooks',
        },
      ),
    });

    expect(tools.repromptSimilarQuestionConfirmation).toHaveBeenCalled();
    expect(tools.continueCreateQuestionDespiteSimilar).not.toHaveBeenCalled();
    expect(response).toEqual({
      status: 'answered',
      response: 'Reply yes to add the question anyway, or no/cancel to abort.',
      awaitingInput: 'confirmAddDespiteSimilar',
      similarQuestions: [
        {
          id: 'q1',
          questionText: 'Explain React hooks.',
          score: 0.9,
          href: '/questions/q1',
        },
      ],
    });
  });
});
