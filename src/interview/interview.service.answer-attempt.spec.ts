import { BadRequestException } from '@nestjs/common';

import { ApiErrorCode } from '../common/errors/api-error.codes';
import type { DatabaseService } from '../database/database.service';
import type { QuestionService } from '../question/question.service';
import type { MediaCleanupService } from '../upload/media-cleanup.service';
import { InterviewService } from './interview.service';

describe('InterviewService answer attempt reserve + finalize', () => {
  const envBackup = process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION;

  afterEach(() => {
    if (envBackup === undefined) {
      delete process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION;
    } else {
      process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION = envBackup;
    }
  });

  function makeService(lockRow: Record<string, unknown>) {
    let currentRow = lockRow;
    const clientQuery = vi
      .fn()
      .mockImplementation(async (_sql: string, params: unknown[]) => {
        const answersJson = JSON.parse(String(params[5]));
        currentRow = {
          ...currentRow,
          answers_json: answersJson,
          status: 'in_progress',
          updated_at: new Date(),
        };
        return { rows: [currentRow], rowCount: 1 };
      });
    const withTransaction = vi.fn(
      async (fn: (client: { query: ReturnType<typeof vi.fn> }) => unknown) =>
        fn({ query: clientQuery }),
    );
    const databaseService = {
      withTransaction,
    } as unknown as DatabaseService;
    const questionService = {
      hydrateStoredQuestionCore: vi.fn((question) => question),
      processPendingDeletionsAfterTerminalInterview: vi.fn(),
    } as unknown as QuestionService;
    const mediaCleanupService = {
      deleteInterviewMedia: vi.fn(),
    } as unknown as MediaCleanupService;

    const service = new InterviewService(
      databaseService,
      questionService,
      mediaCleanupService,
    );

    vi.spyOn(
      service as unknown as {
        lockInterviewForUpdate: ReturnType<typeof vi.fn>;
      },
      'lockInterviewForUpdate',
    ).mockImplementation(async () => currentRow);

    return { service };
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
    assigned_hr_id: null,
    demo: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const behaviorSignals = {
    tabHiddenCount: 0,
    windowBlurCount: 0,
    pasteCount: 0,
    keydownCount: 0,
    copyCount: 0,
    resizeCount: 0,
  };

  it('reserves up to max and blocks camera/screen overwrite on progress', async () => {
    process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION = '3';
    const { service } = makeService(baseRow);
    const mediaKey = 'dev/interviews/interview-1/answers/q0-camera-1.webm';
    const screenKey = 'dev/interviews/interview-1/answers/q0-screen-1.webm';
    const progressInput = {
      questionIndex: 0,
      versionNumber: 1,
      mediaKey,
      screenMediaKey: screenKey,
      behaviorSignals,
    };

    await service.reserveAnswerAttempt('interview-1', { questionIndex: 0 });
    await service.reserveAnswerAttempt('interview-1', { questionIndex: 0 });
    await service.reserveAnswerAttempt('interview-1', { questionIndex: 0 });

    await expect(
      service.reserveAnswerAttempt('interview-1', { questionIndex: 0 }),
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: ApiErrorCode.ANSWER_ATTEMPT_LIMIT_REACHED,
        }),
      }),
    );

    await expect(
      service.saveAnswerProgress('interview-1', progressInput),
    ).resolves.toBeTruthy();

    const preserved = await service.saveAnswerProgress('interview-1', {
      questionIndex: 0,
      versionNumber: 1,
      mediaKey,
      behaviorSignals,
    });
    expect(
      preserved.answers
        .find((item) => item.questionIndex === 0)
        ?.versions?.find((version) => version.versionNumber === 1)
        ?.screenMediaKey,
    ).toBe(screenKey);

    await expect(
      service.saveAnswerProgress('interview-1', {
        ...progressInput,
        mediaKey: 'dev/interviews/interview-1/answers/q0-camera-2.webm',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: ApiErrorCode.ANSWER_VERSION_OVERWRITE_FORBIDDEN,
        }),
      }),
    );

    await expect(
      service.saveAnswerProgress('interview-1', {
        ...progressInput,
        screenMediaKey: 'dev/interviews/interview-1/answers/q0-screen-2.webm',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: ApiErrorCode.ANSWER_VERSION_OVERWRITE_FORBIDDEN,
        }),
      }),
    );

    await expect(
      service.saveAnswerProgress('interview-1', {
        ...progressInput,
        versionNumber: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('finalizes stub-last via earlier media and stays idempotent', async () => {
    const mediaKey = 'dev/interviews/interview-1/answers/q0-camera-2.webm';
    const { service } = makeService({
      ...baseRow,
      status: 'in_progress',
      answers_json: [
        {
          questionIndex: 0,
          questionId: 'q1',
          status: 'recording',
          mediaKey: '',
          uploadedAt: new Date().toISOString(),
          selectedVersionNumber: 3,
          versions: [
            {
              versionNumber: 1,
              mediaKey: '',
              reservedAt: new Date().toISOString(),
              uploadedAt: new Date().toISOString(),
            },
            {
              versionNumber: 2,
              mediaKey,
              uploadedAt: new Date().toISOString(),
            },
            {
              versionNumber: 3,
              mediaKey: '',
              reservedAt: new Date().toISOString(),
              uploadedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    const first = await service.finalizeAnswer('interview-1', {
      questionIndex: 0,
    });
    expect(first.selectedVersionNumber).toBe(2);
    expect(first.alreadySubmitted).toBe(false);
    expect(
      first.interview.answers.find((item) => item.questionIndex === 0)
        ?.mediaKey,
    ).toBe(mediaKey);

    const second = await service.finalizeAnswer('interview-1', {
      questionIndex: 0,
    });
    expect(second.alreadySubmitted).toBe(true);
    expect(second.selectedVersionNumber).toBe(2);
  });
});
