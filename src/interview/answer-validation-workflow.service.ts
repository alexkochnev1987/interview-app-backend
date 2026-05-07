import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Answer,
  AnswerEvaluation,
  AnswerTranscript,
  AnswerValidationStatus,
  AnswerVersion,
  InterviewQuestion,
} from './interfaces/interview.interface';
import { InterviewService } from './interview.service';
import { resolveNativeProvider } from '../ai/llm/ai-env';
import { transcribeInterviewMedia } from '../ai/llm/whisper-transcribe';
import {
  evaluateAnswerWithNativeLlm,
  RawAnswerEvaluation,
} from '../ai/llm/answer-evaluation-llm';
import { computeAnswerBehaviorRisk } from './answer-behavior-risk';

export interface StartAnswerValidationResult {
  status: AnswerValidationStatus;
  questionIndex: number;
  sourceVersionNumber: number;
  reused: boolean;
}

export interface StartAllAnswerValidationsResult {
  ok: true;
  interviewId: string;
  requestedCount: number;
  queuedCount: number;
  reusedCount: number;
  skippedCount: number;
  answers: StartAnswerValidationResult[];
}

@Injectable()
export class AnswerValidationWorkflowService
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(AnswerValidationWorkflowService.name);
  private readonly interviewLocks = new Map<string, Promise<unknown>>();

  constructor(private readonly interviewService: InterviewService) {}

  async onApplicationBootstrap(): Promise<void> {
    const interviews = await this.interviewService.findAll();
    const now = new Date();
    for (const interview of interviews) {
      for (const answer of interview.answers) {
        const status = answer.validation?.status;
        if (status !== 'queued' && status !== 'processing') {
          continue;
        }

        try {
          await this.withInterviewLock(interview.id, () =>
            this.interviewService.failAnswerValidation(interview.id, {
              questionIndex: answer.questionIndex,
              sourceVersionNumber: answer.validation?.sourceVersionNumber,
              runId: answer.validation?.runId,
              errorMessage:
                'Validation worker restarted before this run completed. Re-run AI evaluation to retry.',
              completedAt: now,
            }),
          );
          this.logger.log(
            `Marked stuck validation as failed: interview=${interview.id} question=${answer.questionIndex}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to mark stuck validation: interview=${interview.id} question=${answer.questionIndex}: ${this.formatError(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }
  }

  private async withInterviewLock<T>(
    interviewId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const previous = this.interviewLocks.get(interviewId) ?? Promise.resolve();
    let resolveNext: () => void = () => {};
    const tracker = new Promise<void>((resolve) => {
      resolveNext = resolve;
    });
    const entry: Promise<unknown> = tracker.finally(() => {
      if (this.interviewLocks.get(interviewId) === entry) {
        this.interviewLocks.delete(interviewId);
      }
    });
    this.interviewLocks.set(interviewId, entry);
    return previous.catch(() => undefined).then(async () => {
      try {
        return await fn();
      } finally {
        resolveNext();
      }
    });
  }

  startValidation(
    interviewId: string,
    questionIndex: number,
    force = false,
  ): Promise<StartAnswerValidationResult> {
    return this.dispatchValidation(interviewId, questionIndex, force);
  }

  async startValidationForAllSubmitted(
    interviewId: string,
    force = false,
  ): Promise<StartAllAnswerValidationsResult> {
    if (!resolveNativeProvider()) {
      throw new ServiceUnavailableException(
        'AI provider is not configured. Set AI_PROVIDER and the matching API key.',
      );
    }

    type SpawnPayload = {
      questionIndex: number;
      sourceVersionNumber: number;
      runId: string;
      requestedAt: Date;
      question: InterviewQuestion;
      selectedVersion: AnswerVersion;
      existingTranscript?: AnswerTranscript;
    };

    const reusedAnswers: StartAnswerValidationResult[] = [];
    const newPayloads: SpawnPayload[] = [];
    let requestedCount = 0;
    let totalQuestions = 0;

    await this.withInterviewLock(interviewId, async () => {
      const interview = await this.interviewService.findOne(interviewId);
      totalQuestions = interview.questions.length;

      const submittedAnswers = interview.answers
        .filter((answer) => answer.status === 'submitted')
        .sort((left, right) => left.questionIndex - right.questionIndex);

      requestedCount = submittedAnswers.length;

      if (!force) {
        const hasActiveValidation = submittedAnswers.some(
          (answer) =>
            answer.validation?.status === 'queued' ||
            answer.validation?.status === 'processing',
        );
        if (hasActiveValidation) {
          throw new ConflictException(
            'Answer validation is already running for this interview.',
          );
        }
      }

      const requestedAt = new Date();

      for (const answer of submittedAnswers) {
        const selectedVersion = this.resolveSelectedVersion(answer);
        if (!selectedVersion?.mediaKey) {
          throw new BadRequestException(
            `Question ${answer.questionIndex} does not have an uploaded answer media key`,
          );
        }

        const sourceVersionNumber = selectedVersion.versionNumber;
        const existingValidation = answer.validation;

        if (
          !force &&
          existingValidation &&
          existingValidation.sourceVersionNumber === sourceVersionNumber &&
          existingValidation.status === 'completed'
        ) {
          reusedAnswers.push({
            status: existingValidation.status,
            questionIndex: answer.questionIndex,
            sourceVersionNumber,
            reused: true,
          });
          continue;
        }

        const question = interview.questions[answer.questionIndex];
        if (!question) {
          throw new BadRequestException(
            `Question ${answer.questionIndex} is out of range`,
          );
        }

        newPayloads.push({
          questionIndex: answer.questionIndex,
          sourceVersionNumber,
          runId: randomUUID(),
          requestedAt,
          question,
          selectedVersion,
          existingTranscript: answer.transcript,
        });
      }

      if (newPayloads.length > 0) {
        await this.interviewService.queueAnswerValidations(
          interviewId,
          newPayloads.map((payload) => ({
            questionIndex: payload.questionIndex,
            sourceVersionNumber: payload.sourceVersionNumber,
            runId: payload.runId,
            requestedAt: payload.requestedAt,
          })),
        );
      }
    });

    for (const payload of newPayloads) {
      this.logger.log(
        `[validate] queued interview=${interviewId} q=${payload.questionIndex} v=${payload.sourceVersionNumber} runId=${payload.runId} mediaKey=${payload.selectedVersion.mediaKey}`,
      );
      void this.runInProcess({
        interviewId,
        questionIndex: payload.questionIndex,
        sourceVersionNumber: payload.sourceVersionNumber,
        runId: payload.runId,
        requestedAt: payload.requestedAt,
        question: payload.question,
        selectedVersion: payload.selectedVersion,
        existingTranscript: payload.existingTranscript,
      }).catch((error) => {
        this.logger.error(
          `[validate] runInProcess unhandled rejection for interview=${interviewId} question=${payload.questionIndex}: ${this.formatError(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }

    const queuedAnswers: StartAnswerValidationResult[] = newPayloads.map(
      (payload) => ({
        status: 'queued',
        questionIndex: payload.questionIndex,
        sourceVersionNumber: payload.sourceVersionNumber,
        reused: false,
      }),
    );

    const orderedAnswers = [...reusedAnswers, ...queuedAnswers].sort(
      (left, right) => left.questionIndex - right.questionIndex,
    );

    return {
      ok: true,
      interviewId,
      requestedCount,
      queuedCount: queuedAnswers.length,
      reusedCount: reusedAnswers.length,
      skippedCount: Math.max(totalQuestions - requestedCount, 0),
      answers: orderedAnswers,
    };
  }

  private async dispatchValidation(
    interviewId: string,
    questionIndex: number,
    force: boolean,
  ): Promise<StartAnswerValidationResult> {
    if (!resolveNativeProvider()) {
      throw new ServiceUnavailableException(
        'AI provider is not configured. Set AI_PROVIDER and the matching API key.',
      );
    }

    type SpawnPayload = {
      sourceVersionNumber: number;
      runId: string;
      requestedAt: Date;
      question: InterviewQuestion;
      selectedVersion: AnswerVersion;
      existingTranscript?: AnswerTranscript;
    };

    let reusedResult: StartAnswerValidationResult | undefined;
    let spawnPayload: SpawnPayload | undefined;

    await this.withInterviewLock(interviewId, async () => {
      const interview = await this.interviewService.findOne(interviewId);
      const answer = interview.answers.find(
        (item) => item.questionIndex === questionIndex,
      );

      if (!answer) {
        throw new BadRequestException(
          `Answer for question ${questionIndex} is not available`,
        );
      }

      if (answer.status !== 'submitted') {
        throw new BadRequestException(
          `Question ${questionIndex} must be submitted before validation starts`,
        );
      }

      const selectedVersion = this.resolveSelectedVersion(answer);
      if (!selectedVersion?.mediaKey) {
        throw new BadRequestException(
          `Question ${questionIndex} does not have an uploaded answer media key`,
        );
      }

      const sourceVersionNumber = selectedVersion.versionNumber;
      const existingValidation = answer.validation;
      if (
        !force &&
        existingValidation?.sourceVersionNumber === sourceVersionNumber &&
        (existingValidation.status === 'queued' ||
          existingValidation.status === 'processing')
      ) {
        throw new ConflictException(
          `Answer validation is already running for question ${questionIndex}.`,
        );
      }
      if (
        !force &&
        existingValidation &&
        existingValidation.sourceVersionNumber === sourceVersionNumber &&
        existingValidation.status === 'completed'
      ) {
        reusedResult = {
          status: existingValidation.status,
          questionIndex,
          sourceVersionNumber,
          reused: true,
        };
        return;
      }

      const question = interview.questions[questionIndex];
      if (!question) {
        throw new BadRequestException(
          `Question ${questionIndex} is out of range`,
        );
      }

      const requestedAt = new Date();
      const runId = randomUUID();
      await this.interviewService.queueAnswerValidation(interview.id, {
        questionIndex,
        sourceVersionNumber,
        runId,
        requestedAt,
      });

      spawnPayload = {
        sourceVersionNumber,
        runId,
        requestedAt,
        question,
        selectedVersion,
        existingTranscript: answer.transcript,
      };
    });

    if (reusedResult) {
      return reusedResult;
    }

    if (!spawnPayload) {
      throw new Error(
        `dispatchValidation produced no payload for interview=${interviewId} question=${questionIndex}`,
      );
    }

    this.logger.log(
      `[validate] queued interview=${interviewId} q=${questionIndex} v=${spawnPayload.sourceVersionNumber} runId=${spawnPayload.runId} mediaKey=${spawnPayload.selectedVersion.mediaKey}`,
    );

    void this.runInProcess({
      interviewId,
      questionIndex,
      sourceVersionNumber: spawnPayload.sourceVersionNumber,
      runId: spawnPayload.runId,
      requestedAt: spawnPayload.requestedAt,
      question: spawnPayload.question,
      selectedVersion: spawnPayload.selectedVersion,
      existingTranscript: spawnPayload.existingTranscript,
    }).catch((error) => {
      this.logger.error(
        `[validate] runInProcess unhandled rejection for interview=${interviewId} question=${questionIndex}: ${this.formatError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });

    return {
      status: 'queued',
      questionIndex,
      sourceVersionNumber: spawnPayload.sourceVersionNumber,
      reused: false,
    };
  }

  private async runInProcess(params: {
    interviewId: string;
    questionIndex: number;
    sourceVersionNumber: number;
    runId: string;
    requestedAt: Date;
    question: InterviewQuestion;
    selectedVersion: AnswerVersion;
    existingTranscript?: AnswerTranscript;
  }): Promise<void> {
    const {
      interviewId,
      questionIndex,
      sourceVersionNumber,
      runId,
      requestedAt,
      question,
      selectedVersion,
      existingTranscript,
    } = params;

    try {
      const provider = resolveNativeProvider();
      if (!provider) {
        throw new Error(
          'AI provider became unavailable while validation was running.',
        );
      }

      this.logger.log(
        `[validate] runInProcess start interview=${interviewId} q=${questionIndex} provider=${provider.kind}/${provider.model}`,
      );

      let transcriptText: string;
      let transcript: AnswerTranscript;
      const whisperT0 = Date.now();
      try {
        const whisperResult = await transcribeInterviewMedia(
          selectedVersion.mediaKey,
        );
        this.logger.log(
          `[validate] whisper ok interview=${interviewId} q=${questionIndex} ms=${Date.now() - whisperT0} chars=${whisperResult.text.length} lang=${whisperResult.language ?? '?'}`,
        );
        transcriptText = whisperResult.text;
        transcript = {
          text: whisperResult.text,
          language: whisperResult.language,
          provider: 'openai-whisper',
          generatedAt: new Date(),
          isFinal: true,
        };
      } catch (whisperError) {
        const previous = existingTranscript;
        const fallbackText = previous?.text?.trim();
        if (!previous || !fallbackText) {
          throw whisperError;
        }
        this.logger.warn(
          `[validate] whisper failed interview=${interviewId} q=${questionIndex} ms=${Date.now() - whisperT0} err="${this.formatError(whisperError)}" — falling back to existing transcript (${fallbackText.length} chars)`,
        );
        transcriptText = fallbackText;
        transcript = {
          ...previous,
          text: fallbackText,
          provider: 'whisper-fallback-existing',
          isFinal: true,
        };
      }

      const llmT0 = Date.now();
      const rawEvaluation = await evaluateAnswerWithNativeLlm(
        provider,
        question,
        transcriptText,
      );
      this.logger.log(
        `[validate] llm ok interview=${interviewId} q=${questionIndex} ms=${Date.now() - llmT0} score=${rawEvaluation.overallScore ?? '?'} hint=${rawEvaluation.decisionHint ?? '?'}`,
      );

      const behaviorRisk = computeAnswerBehaviorRisk(
        selectedVersion.behaviorSignals,
        selectedVersion.durationSeconds,
      );

      const evaluation: AnswerEvaluation = {
        overallScore: this.clampScore(rawEvaluation.overallScore),
        categoryScores: this.normalizeCategoryScores(
          rawEvaluation.categoryScores,
        ),
        coveredConceptIds: this.filterConceptIds(
          rawEvaluation.coveredConceptIds,
          question.expectedConcepts.map((concept) => concept.id),
        ),
        missedConceptIds: this.filterConceptIds(
          rawEvaluation.missedConceptIds,
          question.expectedConcepts.map((concept) => concept.id),
        ),
        redFlagIds: this.filterConceptIds(
          rawEvaluation.redFlagIds,
          question.redFlags.map((flag) => flag.id),
        ),
        behaviorRisk,
        summary: rawEvaluation.summary?.trim() || undefined,
        decisionHint: this.normalizeDecisionHint(rawEvaluation.decisionHint),
        evaluatedAt: new Date(),
      };

      await this.withInterviewLock(interviewId, async () => {
        await this.interviewService.completeAnswerValidation(interviewId, {
          questionIndex,
          sourceVersionNumber,
          runId,
          requestedAt,
          transcript,
          evaluation,
          completedAt: new Date(),
        });
      });

      this.logger.log(
        `[validate] persisted+done interview=${interviewId} q=${questionIndex} score=${evaluation.overallScore ?? '?'}`,
      );
    } catch (error) {
      this.logger.error(
        `[validate] failed step=runInProcess interview=${interviewId} question=${questionIndex}: ${this.formatError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      try {
        await this.withInterviewLock(interviewId, () =>
          this.interviewService.failAnswerValidation(interviewId, {
            questionIndex,
            sourceVersionNumber,
            runId,
            errorMessage: this.formatError(error),
            completedAt: new Date(),
          }),
        );
      } catch (saveError) {
        this.logger.error(
          `[validate] failed to record validation failure for interview=${interviewId} question=${questionIndex}: ${this.formatError(saveError)}`,
          saveError instanceof Error ? saveError.stack : undefined,
        );
      }
    }
  }

  private resolveSelectedVersion(answer: Answer): AnswerVersion | undefined {
    if (answer.versions?.length) {
      return (
        answer.versions.find(
          (version) =>
            version.versionNumber === (answer.selectedVersionNumber ?? 1),
        ) ?? answer.versions[answer.versions.length - 1]
      );
    }

    if (!answer.mediaKey) {
      return undefined;
    }

    return {
      versionNumber: answer.selectedVersionNumber ?? 1,
      mediaKey: answer.mediaKey,
      screenMediaKey: answer.screenMediaKey,
      uploadedAt: answer.uploadedAt,
      durationSeconds: answer.durationSeconds,
      startedAt: answer.startedAt,
      submittedAt: answer.submittedAt,
      camera: answer.camera,
      screen: answer.screen,
      behaviorSignals: answer.behaviorSignals,
      behaviorEvents: answer.behaviorEvents,
    };
  }

  private clampScore(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private normalizeCategoryScores(
    value: RawAnswerEvaluation['categoryScores'],
  ): Record<string, number> | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const result: Record<string, number> = {};
    for (const [key, raw] of Object.entries(value)) {
      const score = this.clampScore(raw);
      if (typeof score === 'number') {
        result[key] = score;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  private filterConceptIds(
    value: unknown,
    allowedIds: string[],
  ): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const allowed = new Set(allowedIds);
    const filtered = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item && allowed.has(item));

    return filtered.length > 0 ? filtered : undefined;
  }

  private normalizeDecisionHint(
    value: unknown,
  ): 'pass' | 'review' | 'fail' | undefined {
    if (value === 'pass' || value === 'review' || value === 'fail') {
      return value;
    }
    return undefined;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return typeof error === 'string' ? error : 'Unknown error';
  }
}
