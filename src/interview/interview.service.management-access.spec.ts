import { ForbiddenException } from '@nestjs/common';
import { InterviewService } from './interview.service';
import type { DatabaseService } from '../database/database.service';
import type { QuestionService } from '../question/question.service';
import type { MediaCleanupService } from '../upload/media-cleanup.service';

describe('InterviewService management access', () => {
  function makeService(lockRow: Record<string, unknown>) {
    const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const withTransaction = jest.fn(async (fn: (client: { query: jest.Mock }) => unknown) =>
      fn({ query: clientQuery }),
    );
    const databaseService = {
      withTransaction,
    } as unknown as DatabaseService;
    const questionService = {
      hydrateStoredQuestionCore: jest.fn((question) => question),
      processPendingDeletionsAfterTerminalInterview: jest.fn(),
    } as unknown as QuestionService;
    const mediaCleanupService = {
      deleteInterviewMedia: jest.fn(),
    } as unknown as MediaCleanupService;

    const service = new InterviewService(
      databaseService,
      questionService,
      mediaCleanupService,
    );

    jest.spyOn(service as unknown as { lockInterviewForUpdate: jest.Mock }, 'lockInterviewForUpdate')
      .mockResolvedValue(lockRow);

    return { service, clientQuery, mediaCleanupService };
  }

  const baseRow = {
    id: 'interview-1',
    candidate_name: 'Candidate',
    candidate_email: null,
    position: 'Engineer',
    interview_locale: 'en',
    questions_json: [{ id: 'q1', text: 'Question' }],
    answers_json: [],
    status: 'pending',
    result_json: null,
    workflow_json: null,
    created_by_id: 'hr-owner',
    demo: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  it('rejects cancel for HR users who do not own the interview under lock', async () => {
    const { service } = makeService(baseRow);

    await expect(
      service.cancel('interview-1', { id: 'other-hr', role: 'hr', demo: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects delete for demo scope mismatches under lock', async () => {
    const { service } = makeService({
      ...baseRow,
      status: 'completed',
      demo: true,
    });

    await expect(
      service.deleteCompleted('interview-1', {
        id: 'admin',
        role: 'admin',
        demo: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns deleted even when post-commit S3 cleanup fails', async () => {
    const { service, mediaCleanupService } = makeService({
      ...baseRow,
      status: 'completed',
    });
    jest
      .spyOn(mediaCleanupService, 'deleteInterviewMedia')
      .mockRejectedValue(new Error('S3 unavailable'));

    await expect(
      service.deleteCompleted('interview-1', {
        id: 'hr-owner',
        role: 'hr',
        demo: false,
      }),
    ).resolves.toEqual({ id: 'interview-1', deleted: true });
  });
});
