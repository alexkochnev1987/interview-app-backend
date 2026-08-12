import { RecruiterConversationFlowService } from './recruiter-conversation-flow.service';
import { startConversationFlow } from './recruiter-conversation-slots';

describe('RecruiterConversationFlowService', () => {
  const tools = {
    continueAssignHrFlow: vi.fn(),
    continueCreateQuestionFlow: vi.fn(),
    continueCreateInterviewFlow: vi.fn(),
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
});
