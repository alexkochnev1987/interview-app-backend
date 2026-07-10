import { Injectable, Logger } from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import {
  apiBadRequest,
  apiConflict,
  apiNotFound,
  apiServiceUnavailable,
} from '../common/errors/api-error';
import { resolveNativeProvider } from '../ai/llm/ai-env';
import type { NativeProviderConfig } from '../ai/llm/ai-env';
import { generateCandidateFeedbackQuestionWithNativeLlm } from '../ai/llm/candidate-feedback-llm';
import {
  buildOverallQuestionTextsInput,
  generateCandidateFeedbackOverallWithNativeLlm,
} from '../ai/llm/candidate-feedback-overall-llm';
import { DatabaseService } from '../database/database.service';
import { getAnswerValidationSubmissionBlockReason } from '../interview/answer-validation-rules';
import { prepareQuestionForEvaluation } from '../interview/prepare-evaluation-question';
import { resolveSelectedAnswerVersion } from '../interview/resolve-selected-answer-version';
import {
  Answer,
  AnswerBehaviorSignals,
  Interview,
} from '../interview/interfaces/interview.interface';
import {
  CandidateFeedbackRegenerationBlockReason,
  getRegenerationBlockReason,
} from './candidate-feedback-block-rules';
import { CandidateFeedbackService } from './candidate-feedback.service';
import { collectCandidateFeedbackQuestionSourceTexts } from './candidate-feedback-source-text';
import { CandidateFeedbackQuestionBlockDto } from './dto/candidate-feedback.responses.dto';
import {
  presentCandidateFeedback,
  presentCandidateFeedbackQuestionBlock,
} from './present-candidate-feedback';

export type QuestionGenerationSkipReason =
  | CandidateFeedbackRegenerationBlockReason
  | 'not_submitted'
  | 'missing_answer'
  | 'missing_transcript'
  | 'missing_question';

export type QuestionGenerationBatchResult =
  | { status: 'generated'; questionIndex: number }
  | { status: 'skipped'; questionIndex: number; reason: QuestionGenerationSkipReason }
  | { status: 'failed'; questionIndex: number; errorMessage: string };

export type OverallGenerationBatchResult =
  | { status: 'generated' }
  | {
      status: 'skipped';
      reason:
        | CandidateFeedbackRegenerationBlockReason
        | 'no_question_texts';
    }
  | { status: 'failed'; errorMessage: string };

export interface GenerateAllCandidateFeedbackResult {
  feedback: ReturnType<typeof presentCandidateFeedback>;
  questions: QuestionGenerationBatchResult[];
  overall: OverallGenerationBatchResult;
}

interface QuestionGenerationContext {
  questionIndex: number;
  transcriptText: string;
  behaviorSignals: AnswerBehaviorSignals;
  durationSeconds?: number;
  llmInput: Parameters<typeof generateCandidateFeedbackQuestionWithNativeLlm>[1];
}

@Injectable()
export class CandidateFeedbackGenerationService {
  private readonly logger = new Logger(CandidateFeedbackGenerationService.name);

  constructor(
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly databaseService: DatabaseService,
  ) {}

  async generateQuestionBlock(
    interview: Interview,
    questionIndex: number,
  ): Promise<CandidateFeedbackQuestionBlockDto> {
    const provider = this.requireProvider();
    await this.candidateFeedbackService.syncQuestionsFromInterview(interview);

    const result = await this.generateQuestionBlockBatch(
      interview,
      questionIndex,
      provider,
    );

    if (result.status === 'skipped') {
      this.throwForSkippedQuestion(interview.id, questionIndex, result.reason);
    }
    if (result.status === 'failed') {
      throw apiServiceUnavailable(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        result.errorMessage,
        { interviewId: interview.id, questionIndex },
      );
    }

    const feedback = await this.candidateFeedbackService.findByInterviewId(
      interview.id,
    );
    const block = feedback?.questions.find(
      (item) => item.questionIndex === questionIndex,
    );
    if (!block) {
      throw new Error('Generated candidate feedback question block is missing');
    }
    return presentCandidateFeedbackQuestionBlock(block);
  }

  async generateAll(
    interview: Interview,
  ): Promise<GenerateAllCandidateFeedbackResult> {
    const provider = this.requireProvider();
    await this.candidateFeedbackService.syncQuestionsFromInterview(interview);

    const questionResults: QuestionGenerationBatchResult[] = [];
    for (let questionIndex = 0; questionIndex < interview.questions.length; questionIndex++) {
      questionResults.push(
        await this.generateQuestionBlockBatch(interview, questionIndex, provider),
      );
    }

    const overall = await this.generateOverallBlockBatch(interview, provider);
    const finalFeedback = await this.requireFeedback(interview.id);

    return {
      feedback: presentCandidateFeedback(finalFeedback),
      questions: questionResults,
      overall,
    };
  }

  private async generateQuestionBlockBatch(
    interview: Interview,
    questionIndex: number,
    provider: NativeProviderConfig,
  ): Promise<QuestionGenerationBatchResult> {
    const context = this.buildQuestionGenerationContext(
      interview,
      questionIndex,
    );
    if ('reason' in context) {
      return { status: 'skipped', questionIndex, reason: context.reason };
    }

    const started = await this.withFeedbackLock(interview.id, async () => {
      const skipReason = await this.resolveQuestionRegenerationSkipReason(
        interview.id,
        questionIndex,
      );
      if (skipReason) {
        return { started: false as const, reason: skipReason };
      }

      const began =
        await this.candidateFeedbackService.beginQuestionBlockGeneration(
          interview.id,
          questionIndex,
        );
      if (!began) {
        const reason = await this.resolveQuestionRegenerationSkipReason(
          interview.id,
          questionIndex,
        );
        return {
          started: false as const,
          reason: reason ?? ('in_progress' as const),
        };
      }

      return { started: true as const };
    });

    if (!started.started) {
      return {
        status: 'skipped',
        questionIndex,
        reason: started.reason,
      };
    }

    try {
      const generated = await generateCandidateFeedbackQuestionWithNativeLlm(
        provider,
        context.llmInput,
      );

      const completed = await this.withFeedbackLock(interview.id, () =>
        this.candidateFeedbackService.completeQuestionBlockGeneration(
          interview.id,
          questionIndex,
          {
            kind: 'generated',
            recommendationText: generated.recommendationText,
            improvementText: generated.improvementText,
          },
        ),
      );
      if (!completed) {
        return {
          status: 'skipped',
          questionIndex,
          reason: 'locked',
        };
      }

      return { status: 'generated', questionIndex };
    } catch (error) {
      const errorMessage = this.formatError(error);
      this.logger.error(
        `[generate] failed interview=${interview.id} question=${questionIndex}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.withFeedbackLock(interview.id, () =>
        this.candidateFeedbackService.completeQuestionBlockGeneration(
          interview.id,
          questionIndex,
          { kind: 'failed', errorMessage },
        ),
      );

      return { status: 'failed', questionIndex, errorMessage };
    }
  }

  private async generateOverallBlockBatch(
    interview: Interview,
    provider: NativeProviderConfig,
  ): Promise<OverallGenerationBatchResult> {
    const prepareResult = await this.withFeedbackLock(interview.id, async () => {
      const feedback = await this.requireFeedback(interview.id);
      const blockReason = getRegenerationBlockReason(feedback.overallState);
      if (blockReason) {
        return { kind: 'skip' as const, reason: blockReason };
      }

      const sourceTexts = collectCandidateFeedbackQuestionSourceTexts(
        feedback.questions,
      );
      if (sourceTexts.length === 0) {
        return { kind: 'skip' as const, reason: 'no_question_texts' as const };
      }

      const started =
        await this.candidateFeedbackService.beginOverallBlockGeneration(
          interview.id,
        );
      if (!started) {
        const latest = await this.requireFeedback(interview.id);
        return {
          kind: 'skip' as const,
          reason:
            getRegenerationBlockReason(latest.overallState) ?? 'in_progress',
        };
      }

      const questionTextByIndex = new Map(
        interview.questions.map((question, index) => [
          index,
          prepareQuestionForEvaluation(question, interview.interviewLocale)
            .questionText,
        ]),
      );

      return {
        kind: 'ready' as const,
        llmInput: {
          position: interview.position,
          candidateName: interview.candidateName,
          questionTexts: buildOverallQuestionTextsInput(
            sourceTexts,
            questionTextByIndex,
          ),
          interviewLocale: interview.interviewLocale,
        },
      };
    });

    if (prepareResult.kind === 'skip') {
      if (prepareResult.reason === 'no_question_texts') {
        this.logger.warn(
          `[generate-all] skipping overall interview=${interview.id}: no usable per-question texts`,
        );
      }
      return { status: 'skipped', reason: prepareResult.reason };
    }

    try {
      const generated = await generateCandidateFeedbackOverallWithNativeLlm(
        provider,
        prepareResult.llmInput,
      );

      const completed = await this.withFeedbackLock(interview.id, () =>
        this.candidateFeedbackService.completeOverallBlockGeneration(
          interview.id,
          {
            kind: 'generated',
            recommendationText: generated.recommendationText,
            improvementText: generated.improvementText,
          },
        ),
      );
      if (!completed) {
        return { status: 'skipped', reason: 'locked' };
      }

      return { status: 'generated' };
    } catch (error) {
      const errorMessage = this.formatError(error);
      this.logger.error(
        `[generate-all] overall failed interview=${interview.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.withFeedbackLock(interview.id, () =>
        this.candidateFeedbackService.completeOverallBlockGeneration(
          interview.id,
          { kind: 'failed', errorMessage },
        ),
      );

      return { status: 'failed', errorMessage };
    }
  }

  private buildQuestionGenerationContext(
    interview: Interview,
    questionIndex: number,
  ):
    | QuestionGenerationContext
    | { reason: QuestionGenerationSkipReason } {
    const answer = interview.answers.find(
      (item) => item.questionIndex === questionIndex,
    );
    const submissionBlock = getAnswerValidationSubmissionBlockReason(
      questionIndex,
      answer,
    );
    if (submissionBlock) {
      return { reason: 'not_submitted' };
    }
    if (!answer) {
      return { reason: 'missing_answer' };
    }

    const transcriptText = answer.transcript?.text?.trim();
    if (!transcriptText) {
      return { reason: 'missing_transcript' };
    }

    const interviewQuestion = interview.questions[questionIndex];
    if (!interviewQuestion) {
      return { reason: 'missing_question' };
    }

    const selectedVersion = resolveSelectedAnswerVersion(answer);
    const behaviorSignals = this.resolveBehaviorSignals(
      selectedVersion,
      answer,
    );
    return {
      questionIndex,
      transcriptText,
      behaviorSignals,
      durationSeconds: selectedVersion?.durationSeconds,
      llmInput: {
        question: prepareQuestionForEvaluation(
          interviewQuestion,
          interview.interviewLocale,
        ),
        transcriptText,
        behaviorSignals,
        durationSeconds: selectedVersion?.durationSeconds,
        interviewLocale: interview.interviewLocale,
      },
    };
  }

  private async resolveQuestionRegenerationSkipReason(
    interviewId: string,
    questionIndex: number,
  ): Promise<CandidateFeedbackRegenerationBlockReason | null> {
    const feedback = await this.candidateFeedbackService.findByInterviewId(
      interviewId,
    );
    const question = feedback?.questions.find(
      (item) => item.questionIndex === questionIndex,
    );
    if (!question) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'Candidate feedback question not found',
        { interviewId, questionIndex },
      );
    }

    return getRegenerationBlockReason(question.state);
  }

  private withFeedbackLock<T>(
    interviewId: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    return this.databaseService.withAdvisoryLock(
      `candidate-feedback:${interviewId}`,
      callback,
    );
  }

  private requireProvider(): NativeProviderConfig {
    const provider = resolveNativeProvider();
    if (!provider) {
      throw apiServiceUnavailable(
        ApiErrorCode.AI_PROVIDER_NOT_CONFIGURED,
        'AI provider is not configured. Set AI_PROVIDER and the matching API key.',
      );
    }
    return provider;
  }

  private async requireFeedback(interviewId: string) {
    const feedback = await this.candidateFeedbackService.findByInterviewId(
      interviewId,
    );
    if (!feedback) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'Candidate feedback not found',
        { interviewId },
      );
    }
    return feedback;
  }

  private throwForSkippedQuestion(
    interviewId: string,
    questionIndex: number,
    reason: QuestionGenerationSkipReason,
  ): never {
    if (reason === 'locked') {
      throw apiConflict(
        ApiErrorCode.CONFLICT,
        'Candidate feedback block is locked and cannot be regenerated',
        { interviewId, questionIndex },
      );
    }
    if (reason === 'in_progress') {
      throw apiConflict(
        ApiErrorCode.CONFLICT,
        'Candidate feedback generation is already in progress for this question',
        { interviewId, questionIndex },
      );
    }

    const messageByReason: Record<
      Exclude<QuestionGenerationSkipReason, 'locked' | 'in_progress'>,
      string
    > = {
      not_submitted: `Question ${questionIndex} must be submitted before feedback generation`,
      missing_answer: `Answer for question ${questionIndex} is not available`,
      missing_transcript: `Answer transcript is not available for question ${questionIndex}. Run validation first.`,
      missing_question: `Question ${questionIndex} is not part of this interview`,
    };

    throw apiBadRequest(ApiErrorCode.BAD_REQUEST, messageByReason[reason], {
      interviewId,
      questionIndex,
    });
  }

  private resolveBehaviorSignals(
    selectedVersion: ReturnType<typeof resolveSelectedAnswerVersion>,
    answer: Answer,
  ): AnswerBehaviorSignals {
    const raw: Partial<AnswerBehaviorSignals> =
      selectedVersion?.behaviorSignals ?? answer.behaviorSignals ?? {};
    return {
      tabHiddenCount: raw.tabHiddenCount ?? 0,
      windowBlurCount: raw.windowBlurCount ?? 0,
      pasteCount: raw.pasteCount ?? 0,
      keydownCount: raw.keydownCount ?? 0,
      copyCount: raw.copyCount ?? 0,
      resizeCount: raw.resizeCount ?? 0,
    };
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
