import { ServiceUnavailableException } from '@nestjs/common';
import type { Mocked } from 'vitest';

import { DatabaseService } from '../database/database.service';
import type { Interview } from '../interview/interfaces/interview.interface';
import { CandidateFeedbackGenerationService } from './candidate-feedback-generation.service';
import { CandidateFeedbackService } from './candidate-feedback.service';

vi.mock('../ai/llm/ai-env', () => ({
  resolveNativeProvider: vi.fn(() => ({
    kind: 'openai',
    model: 'test-model',
  })),
}));

describe('CandidateFeedbackGenerationService', () => {
  let candidateFeedbackService: Mocked<CandidateFeedbackService>;
  let databaseService: Mocked<DatabaseService>;
  let service: CandidateFeedbackGenerationService;

  beforeEach(() => {
    candidateFeedbackService = {
      syncQuestionsFromInterview: vi.fn(),
      findByInterviewId: vi.fn(),
      prefillQuestionBlockSkipTemplate: vi.fn(),
      failStuckGeneration: vi.fn(),
    } as unknown as Mocked<CandidateFeedbackService>;

    databaseService = {
      query: vi.fn(),
      withAdvisoryLock: vi.fn(
        async (_key: string, callback: () => Promise<unknown>) => callback(),
      ),
    } as unknown as Mocked<DatabaseService>;

    service = new CandidateFeedbackGenerationService(
      candidateFeedbackService,
      databaseService,
    );
  });

  it('fails question generation when skip prefill cannot be persisted', async () => {
    const interview = {
      id: 'interview-1',
      interviewLocale: 'en',
      questions: [
        {
          id: 'q-0',
          questionText: 'Tell me about caching.',
          primaryLocale: 'en',
          translations: {},
          followUpQuestions: [],
          redFlags: [],
          weight: 1,
          tags: [],
          metadata: {},
          role: 'engineer',
          focus: 'backend',
          category: 'technical',
          subcategory: 'api',
          difficulty: 'medium',
          expectedConcepts: [],
          outputLanguage: 'en',
        },
      ],
      answers: [
        {
          questionIndex: 0,
          questionId: 'q-0',
          status: 'submitted',
          mediaKey: 'media-1',
          uploadedAt: new Date(),
        },
      ],
    } as unknown as Interview;

    candidateFeedbackService.syncQuestionsFromInterview.mockResolvedValue(
      undefined as never,
    );
    candidateFeedbackService.prefillQuestionBlockSkipTemplate.mockResolvedValue(
      false,
    );
    candidateFeedbackService.findByInterviewId.mockResolvedValue({
      id: 'feedback-1',
      interviewId: interview.id,
      overallState: 'not_generated',
      questions: [
        {
          id: 'block-1',
          candidateFeedbackId: 'feedback-1',
          questionIndex: 0,
          questionId: 'q-0',
          state: 'not_generated',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      service.generateQuestionBlock(interview, 0),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('marks stuck generations as failed on bootstrap', async () => {
    databaseService.query.mockResolvedValue({
      rows: [{ interview_id: 'interview-1' }, { interview_id: 'interview-2' }],
    } as never);
    candidateFeedbackService.failStuckGeneration
      .mockResolvedValueOnce({
        recoveredQuestionCount: 2,
        recoveredOverall: false,
      } as never)
      .mockResolvedValueOnce({
        recoveredQuestionCount: 0,
        recoveredOverall: true,
      } as never);

    await service.onApplicationBootstrap();

    expect(
      candidateFeedbackService.failStuckGeneration,
    ).toHaveBeenNthCalledWith(
      1,
      'interview-1',
      'Candidate feedback worker restarted before this run completed. Re-run generation to retry.',
    );
    expect(
      candidateFeedbackService.failStuckGeneration,
    ).toHaveBeenNthCalledWith(
      2,
      'interview-2',
      'Candidate feedback worker restarted before this run completed. Re-run generation to retry.',
    );
  });
});
