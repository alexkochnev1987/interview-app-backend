import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';
import { resolveHrRef } from './recruiter-assistant-hr-ref';
import { resolveInterviewRef } from './recruiter-assistant-interview-ref';

vi.mock('./recruiter-assistant-hr-ref', () => ({
  resolveHrRef: vi.fn(),
}));

vi.mock('./recruiter-assistant-interview-ref', () => ({
  resolveInterviewRef: vi.fn(),
}));

describe('RecruiterAssistantToolsService assign HR flow', () => {
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

  const interview = {
    id: '11111111-1111-4111-8111-111111111111',
    candidateName: 'Alice Smith',
    position: 'React Developer',
    status: 'pending' as const,
    demo: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const conversationStore = {
    update: vi.fn(),
  };
  const pendingActionStore = {
    issue: vi.fn().mockReturnValue('pending-1'),
  };

  const service = new RecruiterAssistantToolsService(
    {} as RecruiterQuestionMatcherService,
    { findAllPaginated: vi.fn() } as never,
    {} as never,
    {} as never,
    { listAll: vi.fn() } as never,
    pendingActionStore as unknown as RecruiterPendingActionStore,
    conversationStore as unknown as RecruiterConversationStore,
    { draftQuestion: vi.fn() } as never,
    { findAll: vi.fn() } as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveInterviewRef).mockReset();
    vi.mocked(resolveHrRef).mockReset();
  });

  it('asks for interview when neither ref is provided', async () => {
    const response = await service.prepareAssignHr(
      { kind: 'assign_hr', interviewRef: {}, hrRef: {} },
      user,
      'en',
      'session-1',
    );

    expect(conversationStore.update).toHaveBeenCalledWith(
      'admin-1',
      'session-1',
      expect.objectContaining({
        flow: 'assign_hr',
        awaitingInput: 'interview',
      }),
    );
    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'interview',
    });
  });

  it('asks for HR when only interview is resolved', async () => {
    vi.mocked(resolveInterviewRef).mockResolvedValue(interview as never);

    const response = await service.prepareAssignHr(
      {
        kind: 'assign_hr',
        interviewRef: { candidateName: 'Alice Smith' },
        hrRef: {},
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'hr',
    });
    expect(conversationStore.update).toHaveBeenCalledWith(
      'admin-1',
      'session-1',
      expect.objectContaining({
        flow: 'assign_hr',
        awaitingInput: 'hr',
        slots: expect.objectContaining({
          interviewId: interview.id,
          interviewRef: 'Alice Smith',
        }),
      }),
    );
  });

  it('returns confirmation when both refs resolve', async () => {
    vi.mocked(resolveInterviewRef).mockResolvedValue(interview as never);
    vi.mocked(resolveHrRef).mockResolvedValue({ id: 'hr-1', name: 'Jane Doe' });

    const response = await service.prepareAssignHr(
      {
        kind: 'assign_hr',
        interviewRef: { candidateName: 'Alice Smith' },
        hrRef: { name: 'Jane Doe' },
      },
      user,
      'en',
      'session-1',
    );

    expect(conversationStore.update).toHaveBeenCalledWith(
      'admin-1',
      'session-1',
      { flow: 'idle', slots: {} },
    );
    expect(response).toMatchObject({
      status: 'needs_confirmation',
      pendingActionId: 'pending-1',
    });
  });

  it('continues the flow from captured slots', async () => {
    vi.mocked(resolveInterviewRef).mockResolvedValue(interview as never);
    vi.mocked(resolveHrRef).mockResolvedValue({ id: 'hr-1', name: 'Jane Doe' });

    const response = await service.continueAssignHrFlow(
      {
        flow: 'assign_hr',
        slots: {
          interviewRef: 'Alice Smith',
          hrName: 'Jane Doe',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response.status).toBe('needs_confirmation');
  });

  it('denies continuation when the user loses assign permission', async () => {
    const response = await service.continueAssignHrFlow(
      {
        flow: 'assign_hr',
        slots: {
          interviewRef: 'Alice Smith',
          hrName: 'Jane Doe',
        },
      },
      { ...user, role: 'hr' },
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'denied',
      escalateTo: 'admin',
    });
    expect(resolveInterviewRef).not.toHaveBeenCalled();
  });
});
