import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

describe('RecruiterAssistantToolsService candidate interview tools', () => {
  const candidate = {
    id: 'candidate-1',
    role: 'candidate' as const,
    demo: false,
    email: 'candidate@example.com',
    name: 'Alice',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };

  const pendingInterview = {
    id: '11111111-1111-4111-8111-111111111111',
    candidateName: 'Alice',
    position: 'React Developer',
    status: 'pending' as const,
    questionCount: 3,
    submittedAnswerCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  const completedInterview = {
    id: '22222222-2222-4222-8222-222222222222',
    candidateName: 'Alice',
    position: 'Backend Developer',
    status: 'completed' as const,
    questionCount: 3,
    submittedAnswerCount: 3,
    decision: 'proceed' as const,
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    updatedAt: new Date('2026-01-04T00:00:00.000Z'),
  };

  const interviewService = {
    findAllForCandidateEmail: vi.fn(),
  };
  const candidateFeedbackService = {
    findByInterviewId: vi.fn(),
    findByInterviewIds: vi.fn(),
  };
  const candidateFeedbackShareService = {
    hasActiveShareLink: vi.fn(),
  };
  const authService = {
    generateCandidatePortalContinueToken: vi
      .fn()
      .mockReturnValue('continue-token'),
  };

  const service = new RecruiterAssistantToolsService(
    {} as RecruiterQuestionMatcherService,
    {} as never,
    interviewService as never,
    candidateFeedbackService as never,
    candidateFeedbackShareService as never,
    {} as never,
    {} as RecruiterPendingActionStore,
    {} as RecruiterConversationStore,
    {} as never,
    {} as never,
    {} as never,
    authService as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    interviewService.findAllForCandidateEmail.mockResolvedValue([
      completedInterview,
      pendingInterview,
    ]);
    candidateFeedbackService.findByInterviewId.mockResolvedValue(null);
    candidateFeedbackShareService.hasActiveShareLink.mockResolvedValue(false);
  });

  it('returns latest interview status for generic candidate status queries', async () => {
    const result = await service.getInterviewStatus({}, candidate, 'en', true);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'answered',
        response: 'Your interview for React Developer is ready to start.',
        interview: expect.objectContaining({
          id: pendingInterview.id,
          candidateLink:
            '/take/11111111-1111-4111-8111-111111111111?token=continue-token&from=portal',
        }),
        redirect: { path: `/portal/interviews/${pendingInterview.id}` },
      }),
    );
  });

  it('returns status for a specific position', async () => {
    const result = await service.getInterviewStatus(
      { position: 'Backend Developer' },
      candidate,
      'en',
      true,
    );

    expect(result.response).toBe(
      'Your interview for Backend Developer is submitted, waiting for feedback.',
    );
    expect(result.interview?.id).toBe(completedInterview.id);
  });

  it('lists uncompleted interviews for the candidate', async () => {
    const result = await service.listOwnInterviews(candidate, 'en', true);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'answered',
        response:
          'You have 1 interview to complete: React Developer (ready to start).',
        interviews: [pendingInterview],
        redirect: { path: '/portal' },
      }),
    );
  });

  it('returns review state for a position-specific candidate query', async () => {
    candidateFeedbackService.findByInterviewId.mockResolvedValue({
      outcome: 'proceed',
      blocks: [],
    });

    const result = await service.getReviewState(
      { position: 'Backend Developer' },
      candidate,
      'en',
    );

    expect(result.response).toBe(
      'Your Backend Developer interview has been reviewed (proceed).',
    );
    expect(result.interview?.reviewState).toEqual(
      expect.objectContaining({
        reviewed: true,
        outcome: 'proceed',
      }),
    );
  });
});
