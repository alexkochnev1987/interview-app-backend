import { resolveHrRef } from './recruiter-assistant-hr-ref';
import { resolveInterviewRef } from './recruiter-assistant-interview-ref';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

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

  const unassignedInterviewListItem = {
    id: interview.id,
    candidateName: interview.candidateName,
    position: interview.position,
    status: interview.status,
    questionCount: 3,
    submittedAnswerCount: 0,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
  };

  const hrUser = {
    id: 'hr-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
  };

  const conversationStore = {
    update: vi.fn(),
  };
  const pendingActionStore = {
    issue: vi.fn().mockReturnValue('pending-1'),
  };
  const interviewService = {
    findAllPaginated: vi.fn(),
  };
  const userService = {
    listAll: vi.fn(),
  };

  const service = new RecruiterAssistantToolsService(
    {} as RecruiterQuestionMatcherService,
    {} as never,
    interviewService as never,
    {} as never,
    {} as never,
    userService as never,
    pendingActionStore as unknown as RecruiterPendingActionStore,
    conversationStore as unknown as RecruiterConversationStore,
    { draftQuestion: vi.fn() } as never,
    { findAll: vi.fn() } as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveInterviewRef).mockReset();
    vi.mocked(resolveHrRef).mockReset();
    interviewService.findAllPaginated.mockResolvedValue({
      items: [unassignedInterviewListItem],
      total: 1,
      page: 1,
      limit: 100,
    });
    userService.listAll.mockResolvedValue([hrUser]);
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
      response: 'Which interview should I assign?',
      interviews: [unassignedInterviewListItem],
    });
    expect(response.response).not.toMatch(/Found \d+ interview/);
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
      response: 'Which HR reviewer should I assign?',
      hrs: [hrUser],
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

  it('returns ambiguous interview message with unassigned list', async () => {
    vi.mocked(resolveInterviewRef).mockResolvedValue(null);

    const response = await service.prepareAssignHr(
      {
        kind: 'assign_hr',
        interviewRef: { candidateName: 'Alice' },
        hrRef: {},
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'interview',
      response:
        "Couldn't detect singular interview, please choose from the list",
      interviews: [unassignedInterviewListItem],
    });
  });

  it('returns ambiguous HR message with HR list', async () => {
    vi.mocked(resolveInterviewRef).mockResolvedValue(interview as never);
    vi.mocked(resolveHrRef).mockResolvedValue(null);

    const response = await service.prepareAssignHr(
      {
        kind: 'assign_hr',
        interviewRef: { candidateName: 'Alice Smith' },
        hrRef: { name: 'Jane' },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'hr',
      response: "Couldn't detect singular HR, please choose from the list",
      hrs: [hrUser],
    });
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

  it('lists all HR reviewers for admins', async () => {
    const response = await service.listHrs(user, 'en');

    expect(userService.listAll).toHaveBeenCalledWith({
      role: 'hr',
      demo: false,
      limit: 100,
    });
    expect(response).toMatchObject({
      status: 'answered',
      response: 'Found 1 HR reviewer(s).',
      hrs: [hrUser],
    });
  });

  it('denies HR list for non-admins', async () => {
    const response = await service.listHrs({ ...user, role: 'hr' }, 'en');

    expect(response).toMatchObject({
      status: 'denied',
      escalateTo: 'admin',
    });
    expect(userService.listAll).not.toHaveBeenCalled();
  });

  it('clears assign_hr flow when no unassigned interviews exist', async () => {
    interviewService.findAllPaginated.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });

    const response = await service.prepareAssignHr(
      { kind: 'assign_hr', interviewRef: {}, hrRef: {} },
      user,
      'en',
      'session-1',
    );

    expect(conversationStore.update).toHaveBeenLastCalledWith(
      'admin-1',
      'session-1',
      { flow: 'idle', slots: {} },
    );
    expect(response).toEqual({
      status: 'answered',
      response: 'No unassigned interviews available.',
      interviews: [],
    });
  });

  it('clears assign_hr flow when no HR reviewers exist', async () => {
    vi.mocked(resolveInterviewRef).mockResolvedValue(interview as never);
    userService.listAll.mockResolvedValue([]);

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

    expect(conversationStore.update).toHaveBeenLastCalledWith(
      'admin-1',
      'session-1',
      { flow: 'idle', slots: {} },
    );
    expect(response).toEqual({
      status: 'answered',
      response: 'No HR reviewers available.',
      hrs: [],
    });
  });
});
