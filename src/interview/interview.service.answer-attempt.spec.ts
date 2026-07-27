import { BadRequestException } from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { InterviewService } from './interview.service';
import type { DatabaseService } from '../database/database.service';
import type { QuestionService } from '../question/question.service';
import type { MediaCleanupService } from '../upload/media-cleanup.service';

describe('InterviewService answer attempt reserve + lock', () => {
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
    const clientQuery = jest.fn().mockImplementation(async (_sql: string, params: unknown[]) => {
      const answersJson = JSON.parse(String(params[5]));
      currentRow = {
        ...currentRow,
        answers_json: answersJson,
        status: 'in_progress',
        updated_at: new Date(),
      };
      return { rows: [currentRow], rowCount: 1 };
    });
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

    jest
      .spyOn(
        service as unknown as { lockInterviewForUpdate: jest.Mock },
        'lockInterviewForUpdate',
      )
      .mockImplementation(async () => currentRow);

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

  it('reserves stub versions up to the limit and rejects the next reserve', async () => {
    process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION = '3';
    const { service } = makeService(baseRow);

    const first = await service.reserveAnswerAttempt('interview-1', {
      questionIndex: 0,
      recordingSessionId: 'session-a',
    });
    expect(first).toMatchObject({
      versionNumber: 1,
      versionCount: 1,
      status: 'recording',
      maxAttempts: 3,
    });

    await service.reserveAnswerAttempt('interview-1', {
      questionIndex: 0,
      recordingSessionId: 'session-other',
    });
    const third = await service.reserveAnswerAttempt('interview-1', {
      questionIndex: 0,
      recordingSessionId: 'session-other',
    });
    expect(third.versionCount).toBe(3);

    await expect(
      service.reserveAnswerAttempt('interview-1', {
        questionIndex: 0,
        recordingSessionId: 'session-other',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: ApiErrorCode.ANSWER_ATTEMPT_LIMIT_REACHED,
        }),
      }),
    );
  });

  it('rejects progress without reserve and allows matching session after reserve', async () => {
    const { service } = makeService(baseRow);
    const mediaKey = 'dev/interviews/interview-1/answers/q0-camera-1.webm';
    const progressInput = {
      questionIndex: 0,
      versionNumber: 1,
      mediaKey,
      behaviorSignals: {
        tabHiddenCount: 0,
        windowBlurCount: 0,
        pasteCount: 0,
        keydownCount: 0,
        copyCount: 0,
        resizeCount: 0,
      },
      recordingSessionId: 'session-a',
    };

    await expect(
      service.saveAnswerProgress('interview-1', progressInput),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.reserveAnswerAttempt('interview-1', {
      questionIndex: 0,
      recordingSessionId: 'session-a',
    });

    await expect(
      service.saveAnswerProgress('interview-1', {
        ...progressInput,
        recordingSessionId: 'session-other',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: ApiErrorCode.RECORDING_SESSION_MISMATCH,
        }),
      }),
    );

    const updated = await service.saveAnswerProgress('interview-1', progressInput);
    const answer = updated.answers.find((item) => item.questionIndex === 0);
    expect(answer?.versions?.[0]?.mediaKey).toBe(mediaKey);
    expect(answer?.recordingSessionId).toBe('session-a');

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

    // Same mediaKey may still update metadata / finalize the reserved slot.
    await expect(
      service.saveAnswerProgress('interview-1', progressInput),
    ).resolves.toBeTruthy();
  });
});
