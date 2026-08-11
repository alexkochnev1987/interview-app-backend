import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
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
import { prepareQuestionForEvaluation } from '../interview/prepare-evaluation-question';
import { resolveSelectedAnswerVersion } from '../interview/resolve-selected-answer-version';
import { AppConfigService } from '../app-config/app-config.service';
import {
  Answer,
  AnswerBehaviorSignals,
  Interview,
} from '../interview/interfaces/interview.interface';
import {
  CandidateFeedbackRegenerationBlockReason,
  getRegenerationBlockReason,
} from './candidate-feedback-block-rules';
import {
  classifyQuestionFeedbackGeneration,
  isQuestionFeedbackEligibilitySkipReason,
  type QuestionFeedbackGenerationSkipReason,
} from './candidate-feedback-eligibility';
import { resolveOverallFeedbackTone } from './candidate-feedback-overall-tone';
import { buildSkipTemplateTexts } from './candidate-feedback-skip-templates';
import { CandidateFeedbackService } from './candidate-feedback.service';
import { collectCandidateFeedbackQuestionSourceTexts } from './candidate-feedback-source-text';
import { CandidateFeedbackQuestionBlockDto } from './dto/candidate-feedback.responses.dto';
import type { CandidateFeedbackGenerateScope } from './dto/generate-candidate-feedback-query.dto';
import {
  presentCandidateFeedback,
  presentCandidateFeedbackQuestionBlock,
} from './present-candidate-feedback';

export type QuestionGenerationSkipReason =
  | CandidateFeedbackRegenerationBlockReason
  | QuestionFeedbackGenerationSkipReason;

export type QuestionGenerationBatchResult =
  | { status: 'queued'; questionIndex: number }
  | { status: 'generated'; questionIndex: number }
  | { status: 'skipped'; questionIndex: number; reason: QuestionGenerationSkipReason }
  | { status: 'failed'; questionIndex: number; errorMessage: string };

export type OverallGenerationBatchResult =
  | { status: 'queued' }
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
  llmInput: Parameters<typeof generateCandidateFeedbackQuestionWithNativeLlm>[1];
}

const CANDIDATE_FEEDBACK_STUCK_GENERATION_ERROR =
  'Candidate feedback worker restarted before this run completed. Re-run generation to retry.';
const CANDIDATE_FEEDBACK_PREFILL_FAILED_ERROR =
  'Candidate feedback skip template could not be saved. Retry generation.';

@Injectable()
export class CandidateFeedbackGenerationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CandidateFeedbackGenerationService.name);
  private readonly generateAllInFlight = new Set<string>();

  constructor(
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly databaseService: DatabaseService,
    @Optional() private readonly appConfig?: AppConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.databaseService.query<{ interview_id: string }>(
      `
        SELECT DISTINCT interview_id
        FROM (
          SELECT interview_id
          FROM candidate_feedback
          WHERE overall_state = 'generating'
          UNION
          SELECT feedback.interview_id
          FROM candidate_feedback_questions question
          INNER JOIN candidate_feedback feedback
            ON feedback.id = question.candidate_feedback_id
          WHERE question.state = 'generating'
        ) stuck
      `,
    );

    for (const row of result.rows) {
      try {
        const recovered = await this.candidateFeedbackService.failStuckGeneration(
          row.interview_id,
          CANDIDATE_FEEDBACK_STUCK_GENERATION_ERROR,
        );
        if (recovered.recoveredOverall || recovered.recoveredQuestionCount > 0) {
          this.logger.log(
            `Marked stuck candidate feedback as failed: interview=${row.interview_id} overall=${recovered.recoveredOverall} questions=${recovered.recoveredQuestionCount}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to mark stuck candidate feedback: interview=${row.interview_id}: ${this.formatError(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async generateQuestionBlock(
    interview: Interview,
    questionIndex: number,
  ): Promise<CandidateFeedbackQuestionBlockDto> {
    if (await this.appConfig?.getBoolean('AI_CANDIDATE_FEEDBACK', true) === false) {
      throw apiServiceUnavailable(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        'AI candidate feedback generation is currently disabled via runtime config.',
      );
    }
    const provider = this.requireProvider();
    await this.candidateFeedbackService.syncQuestionsFromInterview(interview);

    if (this.generateAllInFlight.has(interview.id)) {
      throw apiConflict(
        ApiErrorCode.CONFLICT,
        'Candidate feedback generation is already in progress for this interview',
        { interviewId: interview.id, questionIndex },
      );
    }

    const result = await this.generateQuestionBlockBatch(
      interview,
      questionIndex,
      provider,
    );

    if (result.status === 'skipped') {
      if (isQuestionFeedbackEligibilitySkipReason(result.reason)) {
        const feedback = await this.candidateFeedbackService.findByInterviewId(
          interview.id,
        );
        const block = feedback?.questions.find(
          (item) => item.questionIndex === questionIndex,
        );
        if (!block) {
          throw new Error('Prefilled candidate feedback question block is missing');
        }
        return presentCandidateFeedbackQuestionBlock(block);
      }
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

  async startGenerateAll(
    interview: Interview,
    scope: CandidateFeedbackGenerateScope,
  ): Promise<GenerateAllCandidateFeedbackResult> {
    if (scope !== 'all') {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'Unsupported candidate feedback generation scope',
        { interviewId: interview.id, scope },
      );
    }

    this.requireProvider();
    await this.candidateFeedbackService.syncQuestionsFromInterview(interview);

    const feedback = await this.requireFeedback(interview.id);
    if (await this.appConfig?.getBoolean('AI_CANDIDATE_FEEDBACK', true) === false) {
      throw apiServiceUnavailable(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        'AI candidate feedback generation is currently disabled via runtime config.',
      );
    }
    if (this.hasActiveGeneration(feedback)) {
      throw apiConflict(
        ApiErrorCode.CONFLICT,
        'Candidate feedback generation is already in progress for this interview',
        { interviewId: interview.id },
      );
    }

    this.generateAllInFlight.add(interview.id);
    try {
      const questionResults = await this.planGenerateAllQuestions(interview);
      const overall = await this.planOverallGeneration(
        interview,
        questionResults
          .filter((result) => result.status === 'queued')
          .map((result) => result.questionIndex),
      );
      const willRun =
        questionResults.some((result) => result.status === 'queued') ||
        overall.status === 'queued';

      if (willRun) {
        void this.runGenerateAll(interview).catch((error) => {
          this.logger.error(
            `[generate-all] unhandled rejection interview=${interview.id}: ${this.formatError(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        }).finally(() => {
          this.generateAllInFlight.delete(interview.id);
        });
      } else {
        this.generateAllInFlight.delete(interview.id);
      }

      const currentFeedback = await this.requireFeedback(interview.id);
      return {
        feedback: presentCandidateFeedback(currentFeedback),
        questions: questionResults,
        overall,
      };
    } catch (error) {
      this.generateAllInFlight.delete(interview.id);
      throw error;
    }
  }

  private async runGenerateAll(
    interview: Interview,
  ): Promise<void> {
    const provider = this.requireProvider();

    for (let questionIndex = 0; questionIndex < interview.questions.length; questionIndex++) {
      await this.generateQuestionBlockBatch(interview, questionIndex, provider);
    }

    await this.generateOverallBlockBatch(interview, provider);
  }

  private async planGenerateAllQuestions(
    interview: Interview,
  ): Promise<QuestionGenerationBatchResult[]> {
    const results: QuestionGenerationBatchResult[] = [];
    for (let questionIndex = 0; questionIndex < interview.questions.length; questionIndex++) {
      results.push(await this.planQuestionGeneration(interview, questionIndex));
    }
    return results;
  }

  private async planQuestionGeneration(
    interview: Interview,
    questionIndex: number,
  ): Promise<QuestionGenerationBatchResult> {
    const context = this.buildQuestionGenerationContext(interview, questionIndex);
    if ('reason' in context) {
      const prefillResult = await this.prefillEligibilitySkipTemplate(
        interview,
        questionIndex,
        context.reason,
      );
      if (prefillResult.status !== 'prefilled') {
        return prefillResult.result;
      }
      return { status: 'skipped', questionIndex, reason: context.reason };
    }

    const skipReason = await this.resolveQuestionRegenerationSkipReason(
      interview.id,
      questionIndex,
    );
    if (skipReason) {
      return { status: 'skipped', questionIndex, reason: skipReason };
    }

    return { status: 'queued', questionIndex };
  }

  private async planOverallGeneration(
    interview: Interview,
    queuedQuestionIndexes: number[],
  ): Promise<OverallGenerationBatchResult> {
    const feedback = await this.requireFeedback(interview.id);
    const blockReason = getRegenerationBlockReason(feedback.overallState);
    if (blockReason) {
      return { status: 'skipped', reason: blockReason };
    }

    const sourceTexts = collectCandidateFeedbackQuestionSourceTexts(
      feedback.questions,
    );
    if (sourceTexts.length > 0 || queuedQuestionIndexes.length > 0) {
      return { status: 'queued' };
    }

    return { status: 'skipped', reason: 'no_question_texts' };
  }

  private hasActiveGeneration(feedback: {
    interviewId: string;
    overallState: string;
    questions: Array<{ state: string }>;
  }): boolean {
    return (
      this.generateAllInFlight.has(feedback.interviewId) ||
      feedback.overallState === 'generating' ||
      feedback.questions.some((question) => question.state === 'generating')
    );
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
      const prefillResult = await this.prefillEligibilitySkipTemplate(
        interview,
        questionIndex,
        context.reason,
      );
      if (prefillResult.status !== 'prefilled') {
        return prefillResult.result;
      }
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

      const { toneMode, mixMetadata } = resolveOverallFeedbackTone(
        interview,
        feedback.questions,
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
          toneMode,
          mixMetadata,
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

  private async prefillEligibilitySkipTemplate(
    interview: Interview,
    questionIndex: number,
    reason: QuestionGenerationSkipReason,
  ): Promise<
    | { status: 'prefilled' }
    | { status: 'not_applied'; result: QuestionGenerationBatchResult }
  > {
    if (!isQuestionFeedbackEligibilitySkipReason(reason)) {
      return { status: 'prefilled' };
    }

    const interviewQuestion = interview.questions[questionIndex];
    const questionText = interviewQuestion
      ? prepareQuestionForEvaluation(interviewQuestion, interview.interviewLocale)
          .questionText
      : undefined;
    const template = buildSkipTemplateTexts(
      reason,
      questionText,
      interview.interviewLocale,
    );
    if (!template) {
      return { status: 'prefilled' };
    }

    const applied = await this.withFeedbackLock(interview.id, () =>
      this.candidateFeedbackService.prefillQuestionBlockSkipTemplate(
        interview.id,
        questionIndex,
        {
          recommendationText: template.recommendationText,
          improvementText: template.improvementText,
          skipReason: template.hrHint,
        },
      ),
    );
    if (applied) {
      return { status: 'prefilled' };
    }

    const blockReason = await this.resolveQuestionRegenerationSkipReason(
      interview.id,
      questionIndex,
    );
    if (blockReason) {
      return {
        status: 'not_applied',
        result: { status: 'skipped', questionIndex, reason: blockReason },
      };
    }

    return {
      status: 'not_applied',
      result: {
        status: 'failed',
        questionIndex,
        errorMessage: CANDIDATE_FEEDBACK_PREFILL_FAILED_ERROR,
      },
    };
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
    const classification = classifyQuestionFeedbackGeneration(
      interview,
      answer,
      questionIndex,
    );
    if (classification.action === 'skip') {
      return { reason: classification.reason };
    }

    const interviewQuestion = interview.questions[questionIndex];
    const selectedVersion = resolveSelectedAnswerVersion(answer!);
    const behaviorSignals = this.resolveBehaviorSignals(
      selectedVersion,
      answer!,
    );
    const evaluation = answer?.evaluation;

    return {
      questionIndex,
      llmInput: {
        question: prepareQuestionForEvaluation(
          interviewQuestion,
          interview.interviewLocale,
        ),
        transcriptText: classification.transcriptText,
        behaviorSignals,
        durationSeconds: selectedVersion?.durationSeconds,
        interviewLocale: interview.interviewLocale,
        toneMode: classification.toneMode,
        evaluationContext:
          classification.toneMode === 'transcript_only'
            ? undefined
            : {
                summary: evaluation?.summary,
                decisionHint: evaluation?.decisionHint,
                categoryScores: evaluation?.categoryScores,
                overallScore: evaluation?.overallScore,
              },
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

    return getRegenerationBlockReason(question.state, {
      errorMessage: question.errorMessage,
    });
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

    throw apiBadRequest(
      ApiErrorCode.BAD_REQUEST,
      reason === 'missing_question'
        ? `Question ${questionIndex} is not part of this interview`
        : reason === 'stale_validation'
          ? `Question ${questionIndex} must be re-validated for the currently selected answer version before candidate feedback can be generated`
        : `Question ${questionIndex} is not eligible for AI feedback generation`,
      { interviewId, questionIndex, reason },
    );
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
