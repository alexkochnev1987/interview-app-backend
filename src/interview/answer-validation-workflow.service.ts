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

  constructor(private readonly interviewService: InterviewService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!resolveNativeProvider()) {
      this.logger.warn(
        'AI provider not configured — skipping stuck validation recovery.',
      );
      return;
    }

    const interviews = await this.interviewService.findAll();
    for (const interview of interviews) {
      for (const answer of interview.answers) {
        const status = answer.validation?.status;
        if (status !== 'queued' && status !== 'processing') {
          continue;
        }

        try {
          await this.dispatchValidation(
            interview.id,
            answer.questionIndex,
            true,
          );
          this.logger.log(
            `Recovered stuck validation interview=${interview.id} question=${answer.questionIndex}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to recover validation interview=${interview.id} question=${answer.questionIndex}: ${this.formatError(error)}`,
          );
        }
      }
    }
  }

  startValidation(
    interviewId: string,
    questionIndex: number,
  ): Promise<StartAnswerValidationResult> {
    return this.dispatchValidation(interviewId, questionIndex, false);
  }

  async startValidationForAllSubmitted(
    interviewId: string,
  ): Promise<StartAllAnswerValidationsResult> {
    const interview = await this.interviewService.findOne(interviewId);
    const submittedAnswers = interview.answers
      .filter((answer) => answer.status === 'submitted')
      .sort((left, right) => left.questionIndex - right.questionIndex);

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

    const answers: StartAnswerValidationResult[] = [];
    for (const answer of submittedAnswers) {
      answers.push(
        await this.startValidation(interviewId, answer.questionIndex),
      );
    }

    const queuedCount = answers.filter((item) => !item.reused).length;
    const reusedCount = answers.filter((item) => item.reused).length;

    return {
      ok: true,
      interviewId,
      requestedCount: submittedAnswers.length,
      queuedCount,
      reusedCount,
      skippedCount: Math.max(interview.questions.length - submittedAnswers.length, 0),
      answers,
    };
  }

  private async dispatchValidation(
    interviewId: string,
    questionIndex: number,
    force: boolean,
  ): Promise<StartAnswerValidationResult> {
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
      return {
        status: existingValidation.status,
        questionIndex,
        sourceVersionNumber,
        reused: true,
      };
    }

    const question = interview.questions[questionIndex];
    if (!question) {
      throw new BadRequestException(
        `Question ${questionIndex} is out of range`,
      );
    }

    if (!resolveNativeProvider()) {
      throw new ServiceUnavailableException(
        'AI provider is not configured. Set AI_PROVIDER and the matching API key.',
      );
    }

    const requestedAt = new Date();
    await this.interviewService.queueAnswerValidation(interview.id, {
      questionIndex,
      sourceVersionNumber,
      requestedAt,
    });

    void this.runInProcess({
      interviewId: interview.id,
      questionIndex,
      sourceVersionNumber,
      question,
      selectedVersion,
    });

    return {
      status: 'queued',
      questionIndex,
      sourceVersionNumber,
      reused: false,
    };
  }

  private async runInProcess(params: {
    interviewId: string;
    questionIndex: number;
    sourceVersionNumber: number;
    question: InterviewQuestion;
    selectedVersion: AnswerVersion;
  }): Promise<void> {
    const {
      interviewId,
      questionIndex,
      sourceVersionNumber,
      question,
      selectedVersion,
    } = params;

    try {
      const provider = resolveNativeProvider();
      if (!provider) {
        throw new Error(
          'AI provider became unavailable while validation was running.',
        );
      }

      const whisperResult = await transcribeInterviewMedia(
        selectedVersion.mediaKey,
      );

      const transcript: AnswerTranscript = {
        text: whisperResult.text,
        language: whisperResult.language,
        provider: 'openai-whisper',
        generatedAt: new Date(),
        isFinal: true,
      };

      const rawEvaluation = await evaluateAnswerWithNativeLlm(
        provider,
        question,
        whisperResult.text,
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

      await this.interviewService.completeAnswerValidation(interviewId, {
        questionIndex,
        sourceVersionNumber,
        transcript,
        evaluation,
        completedAt: new Date(),
      });

      await this.interviewService.recomputeResult(interviewId);
    } catch (error) {
      this.logger.error(
        `Answer validation failed for interview=${interviewId} question=${questionIndex}: ${this.formatError(error)}`,
      );

      try {
        await this.interviewService.failAnswerValidation(interviewId, {
          questionIndex,
          sourceVersionNumber,
          errorMessage: this.formatError(error),
          completedAt: new Date(),
        });
      } catch (saveError) {
        this.logger.error(
          `Failed to record validation failure for interview=${interviewId} question=${questionIndex}: ${this.formatError(saveError)}`,
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
