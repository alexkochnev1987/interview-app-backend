import { RecruiterAssistantService } from './recruiter-assistant.service';
import { ActingUser } from './recruiter-assistant.types';
import { NEW_CHAT_WELCOME_RESPONSE } from './recruiter-assistant.policy';

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
    execute: jest.fn(),
  };
  const pendingActionStore = {
    consume: jest.fn(),
    revoke: jest.fn(),
    issue: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
  const conversationStore = {
    issue: jest.fn().mockReturnValue('session-1'),
    get: jest.fn().mockReturnValue({ flow: 'idle', slots: {} }),
    update: jest.fn(),
    clear: jest.fn(),
    clearAllForUser: jest.fn(),
  };
  const intentRouter = {
    classify: jest.fn(),
  };
  const tools = {
    listInterviews: jest.fn(),
    listUnassigned: jest.fn(),
    getInterviewStatus: jest.fn(),
    getReviewState: jest.fn(),
    prepareAssignHr: jest.fn(),
    prepareCreateQuestions: jest.fn(),
    switchLocale: jest.fn(),
    startNewChat: jest.fn().mockReturnValue({
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
  );

  beforeEach(() => {
    jest.clearAllMocks();
    conversationStore.issue.mockReturnValue('session-1');
    conversationStore.get.mockReturnValue({ flow: 'idle', slots: {} });
    tools.startNewChat.mockReturnValue({
      status: 'answered',
      response: NEW_CHAT_WELCOME_RESPONSE,
    });
  });

  it('checks access before executing a stored pending action', async () => {
    intentRouter.classify.mockReturnValue({ kind: 'out_of_scope' });
    pendingActionStore.consume.mockReturnValue({
      type: 'assign_hr',
      interviewId: '11111111-1111-4111-8111-111111111111',
      assignedHrId: '22222222-2222-4222-8222-222222222222',
      assignedHrName: 'Jane Doe',
      interviewLabel: 'Alice Smith (React Developer)',
    });
    executor.execute.mockResolvedValue({ status: 'executed', response: 'done' });

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

  it('starts a new chat with a fresh session', () => {
    conversationStore.issue.mockReturnValue('session-2');

    const response = service.newChat(user);

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

    const response = await service.chat({ message: 'new chat' }, user, 'en');

    expect(conversationStore.clearAllForUser).toHaveBeenCalledWith('user-1');
    expect(pendingActionStore.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(response.sessionId).toBe('session-3');
  });
});
