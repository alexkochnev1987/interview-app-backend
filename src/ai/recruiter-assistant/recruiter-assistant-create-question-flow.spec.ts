import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';
import { AiService } from '../ai.service';
import { QuestionDraftGenerate } from '../question-draft-content';

describe('RecruiterAssistantToolsService create question flow', () => {
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

  const draft: QuestionDraftGenerate = {
    questionText: 'Explain React hooks.',
    followUpQuestions: [],
    expectedConcepts: [],
    redFlags: [],
    difficulty: 'medium',
    weight: 1,
    sampleGoodAnswer: 'Sample',
    minimumPassScore: 3,
    tags: [],
  };

  const conversationStore = { update: jest.fn() };
  const pendingActionStore = { issue: jest.fn().mockReturnValue('pending-1') };
  const aiService = { draftQuestion: jest.fn().mockResolvedValue(draft) };
  const questionMatcher = {
    findSimilarMatchesOverThreshold: jest.fn().mockResolvedValue([]),
  };

  const service = new RecruiterAssistantToolsService(
    questionMatcher as unknown as RecruiterQuestionMatcherService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    pendingActionStore as unknown as RecruiterPendingActionStore,
    conversationStore as unknown as RecruiterConversationStore,
    aiService as unknown as AiService,
    { findAll: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    aiService.draftQuestion.mockResolvedValue(draft);
    questionMatcher.findSimilarMatchesOverThreshold.mockResolvedValue([]);
  });

  it('asks for a question name when missing', async () => {
    const response = await service.prepareCreateQuestion(
      undefined,
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'questionName',
    });
  });

  it('returns confirmation when a draft is generated', async () => {
    const response = await service.prepareCreateQuestion(
      'React hooks',
      user,
      'en',
      'session-1',
    );

    expect(aiService.draftQuestion).toHaveBeenCalled();
    expect(response).toMatchObject({
      status: 'needs_confirmation',
      pendingActionId: 'pending-1',
    });
  });

  it('continues from captured slot', async () => {
    const response = await service.continueCreateQuestionFlow(
      {
        flow: 'create_question',
        slots: { questionName: 'React hooks' },
      },
      user,
      'en',
      'session-1',
    );

    expect(response.status).toBe('needs_confirmation');
  });

  it('returns similar questions when matches are found', async () => {
    questionMatcher.findSimilarMatchesOverThreshold.mockResolvedValue([
      {
        question: { id: 'q1', questionText: 'Explain React hooks.' },
        score: 0.9,
        reasons: [],
      },
    ]);

    const response = await service.prepareCreateQuestion(
      'React hooks',
      user,
      'en',
      'session-1',
    );

    expect(aiService.draftQuestion).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      status: 'answered',
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

  it('drafts after user confirms despite similar matches', async () => {
    const response = await service.continueCreateQuestionDespiteSimilar(
      {
        flow: 'create_question',
        slots: { questionName: 'React hooks' },
      },
      user,
      'en',
      'session-1',
    );

    expect(aiService.draftQuestion).toHaveBeenCalled();
    expect(response).toMatchObject({
      status: 'needs_confirmation',
      pendingActionId: 'pending-1',
    });
  });
});
