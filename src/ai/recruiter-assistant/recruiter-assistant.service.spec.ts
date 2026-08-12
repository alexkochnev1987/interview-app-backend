import { NEW_CHAT_WELCOME_RESPONSE } from './recruiter-assistant.policy';
import { RecruiterAssistantService } from './recruiter-assistant.service';
import { ActingUser } from './recruiter-assistant.types';

describe('RecruiterAssistantService', () => {
  const user: ActingUser = {
    id: 'user-1',
    role: 'admin',
    demo: false,
    email: 'admin@example.com',
    name: 'Admin User',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none',
    hasGoogleAvatar: false,
  };

  const executor = {
    execute: vi.fn(),
  };
  const pendingActionStore = {
    consume: vi.fn(),
    revoke: vi.fn(),
    issue: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const conversationStore = {
    issue: vi.fn().mockReturnValue('session-1'),
    get: vi.fn().mockReturnValue({ flow: 'idle', slots: {} }),
    update: vi.fn(),
    clear: vi.fn(),
    clearAllForUser: vi.fn(),
  };
  const conversationFlow = {
    resumeActiveFlow: vi.fn().mockResolvedValue(null),
  };
  const intentRouter = {
    classify: vi.fn(),
  };
  const tools = {
    listInterviews: vi.fn(),
    listUnassigned: vi.fn(),
    getInterviewStatus: vi.fn(),
    getReviewState: vi.fn(),
    prepareAssignHr: vi.fn(),
    prepareCreateQuestions: vi.fn(),
    switchLocale: vi.fn(),
    startNewChat: vi.fn().mockReturnValue({
      status: 'answered',
      response: NEW_CHAT_WELCOME_RESPONSE,
    }),
  };

  const service = new RecruiterAssistantService(
    intentRouter as never,
    tools as never,
    executor as never,
    pendingActionStore as never,
    conversationStore as never,
    conversationFlow as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    conversationStore.issue.mockReturnValue('session-1');
    conversationStore.get.mockReturnValue({ flow: 'idle', slots: {} });
    conversationFlow.resumeActiveFlow.mockResolvedValue(null);
    tools.startNewChat.mockReturnValue({
      status: 'answered',
      response: NEW_CHAT_WELCOME_RESPONSE,
    });
  });

  it('checks access before executing a stored pending action', async () => {
    intentRouter.classify.mockReturnValue({ kind: 'out_of_scope' });
    pendingActionStore.consume.mockResolvedValue({
      type: 'assign_hr',
      interviewId: '11111111-1111-4111-8111-111111111111',
      assignedHrId: '22222222-2222-4222-8222-222222222222',
      assignedHrName: 'Jane Doe',
      interviewLabel: 'Alice Smith (React Developer)',
    });
    executor.execute.mockResolvedValue({
      status: 'executed',
      response: 'done',
    });

    await service.chat(
      {
        message: 'yes',
        pendingActionId: '33333333-3333-4333-8333-333333333333',
      },
      user,
      'en',
    );

    expect(pendingActionStore.consume).toHaveBeenCalledWith(
      'user-1',
      '33333333-3333-4333-8333-333333333333',
    );
    expect(executor.execute).toHaveBeenCalled();
  });

  it('acknowledges cancellation for a pending action', async () => {
    intentRouter.classify.mockReturnValue({ kind: 'out_of_scope' });
    const response = await service.chat(
      {
        message: 'no',
        pendingActionId: '33333333-3333-4333-8333-333333333333',
      },
      user,
      'en',
    );

    expect(pendingActionStore.revoke).toHaveBeenCalledWith(
      'user-1',
      '33333333-3333-4333-8333-333333333333',
    );
    expect(response).toEqual({
      status: 'answered',
      response: 'Cancelled. No changes were made.',
      sessionId: 'session-1',
    });
  });

  it('starts a new chat with a fresh session', async () => {
    conversationStore.issue.mockReturnValue('session-2');
    pendingActionStore.revokeAllForUser.mockResolvedValue(undefined);

    const response = await service.newChat(user);

    expect(conversationStore.clearAllForUser).toHaveBeenCalledWith('user-1');
    expect(pendingActionStore.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(conversationStore.issue).toHaveBeenCalledWith('user-1');
    expect(response).toEqual({
      status: 'answered',
      response: NEW_CHAT_WELCOME_RESPONSE,
      sessionId: 'session-2',
    });
  });

  it('resets when the user sends a new chat message', async () => {
    intentRouter.classify.mockReturnValue({ kind: 'new_chat' });
    conversationStore.issue.mockReturnValue('session-3');
    pendingActionStore.revokeAllForUser.mockResolvedValue(undefined);

    const response = await service.chat({ message: 'new chat' }, user, 'en');

    expect(conversationStore.clearAllForUser).toHaveBeenCalledWith('user-1');
    expect(pendingActionStore.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(response.sessionId).toBe('session-3');
  });

  it('returns an active flow response before intent routing', async () => {
    intentRouter.classify.mockReturnValue({ kind: 'out_of_scope' });
    conversationFlow.resumeActiveFlow.mockResolvedValue({
      status: 'answered',
      response: 'Which HR reviewer?',
      awaitingInput: 'hr',
    });

    const response = await service.chat({ message: 'Alice' }, user, 'en');

    expect(conversationFlow.resumeActiveFlow).toHaveBeenCalled();
    expect(intentRouter.classify).toHaveBeenCalled();
    expect(response).toEqual({
      status: 'answered',
      response: 'Which HR reviewer?',
      awaitingInput: 'hr',
      sessionId: 'session-1',
    });
  });
});
