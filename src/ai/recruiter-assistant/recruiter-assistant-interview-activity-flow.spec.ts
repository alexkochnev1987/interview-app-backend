import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

describe('RecruiterAssistantToolsService interview activity summary', () => {
  const admin = {
    id: 'admin-1',
    role: 'admin' as const,
    demo: false,
    email: 'admin@example.com',
    name: 'Admin',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };
  const candidate = {
    id: 'candidate-1',
    role: 'candidate' as const,
    demo: false,
    email: 'candidate@example.com',
    name: 'Candidate',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };

  const interviewService = {
    getFacets: vi.fn(),
  };

  const service = new RecruiterAssistantToolsService(
    {} as RecruiterQuestionMatcherService,
    {} as never,
    interviewService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as RecruiterPendingActionStore,
    {} as RecruiterConversationStore,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    interviewService.getFacets.mockResolvedValue({
      totalQuestionCount: 0,
      positions: [],
      statuses: [
        { value: 'pending', count: 2 },
        { value: 'in_progress', count: 1 },
        { value: 'completed', count: 3 },
        { value: 'failed', count: 1 },
      ],
    });
  });

  it('returns interview activity summary for admins', async () => {
    const result = await service.summarizeInterviewActivity(admin, 'en');

    expect(interviewService.getFacets).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: 'admin-1', role: 'admin' }),
    );
    expect(result).toEqual({
      status: 'answered',
      response:
        'Your org has 7 interview(s): 3 active, 3 completed, 1 failed.',
      interviewActivity: {
        pending: 2,
        inProgress: 1,
        processing: 0,
        completed: 3,
        failed: 1,
        active: 3,
        total: 7,
      },
    });
  });

  it('denies candidates', async () => {
    const result = await service.summarizeInterviewActivity(candidate, 'en');

    expect(interviewService.getFacets).not.toHaveBeenCalled();
    expect(result.status).toBe('denied');
    expect(result.escalateTo).toBe('hr');
  });
});
