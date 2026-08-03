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
  };

  const executor = {
    execute: jest.fn(),
  };
  const pendingActionStore = {
    consume: jest.fn(),
    revoke: jest.fn(),
    issue: jest.fn(),
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
  };

  const service = new RecruiterAssistantService(
    intentRouter as never,
    tools as never,
    executor as never,
    pendingActionStore as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks access before executing a stored pending action', async () => {
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
    });
  });
});
