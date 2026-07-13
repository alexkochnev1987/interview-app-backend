import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest, apiConflict, apiNotFound } from '../common/errors/api-error';
import { DatabaseService } from '../database/database.service';
import { Interview } from '../interview/interfaces/interview.interface';
import { isHrPatchableCandidateFeedbackBlockState } from './candidate-feedback-block-rules';
import type { HrPatchableCandidateFeedbackBlockState } from './candidate-feedback-block-rules';
import { getHrPatchBlockReason } from './candidate-feedback-block-rules';
import {
  CandidateFeedback,
  CandidateFeedbackBlockState,
  CandidateFeedbackQuestion,
} from './interfaces/candidate-feedback.interface';

interface CandidateFeedbackRow {
  id: string;
  interview_id: string;
  overall_recommendation_text: string | null;
  overall_improvement_text: string | null;
  overall_state: CandidateFeedbackBlockState;
  overall_error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CandidateFeedbackQuestionRow {
  id: string;
  candidate_feedback_id: string;
  question_index: number;
  question_id: string;
  recommendation_text: string | null;
  improvement_text: string | null;
  state: CandidateFeedbackBlockState;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

const CANDIDATE_FEEDBACK_COLUMNS = `
  id,
  interview_id,
  overall_recommendation_text,
  overall_improvement_text,
  overall_state,
  overall_error_message,
  created_at,
  updated_at
`;

const CANDIDATE_FEEDBACK_QUESTION_COLUMNS = `
  id,
  candidate_feedback_id,
  question_index,
  question_id,
  recommendation_text,
  improvement_text,
  state,
  error_message,
  created_at,
  updated_at
`;

export interface CandidateFeedbackOverallBlockUpdate {
  overallRecommendationText?: string | null;
  overallImprovementText?: string | null;
  overallState?: CandidateFeedbackBlockState;
  overallErrorMessage?: string | null;
}

export interface CandidateFeedbackQuestionBlockUpdate {
  recommendationText?: string | null;
  improvementText?: string | null;
  state?: CandidateFeedbackBlockState;
  errorMessage?: string | null;
}

export interface CandidateFeedbackHrOverallPatch {
  recommendationText?: string;
  improvementText?: string;
  state?: HrPatchableCandidateFeedbackBlockState;
}

export interface CandidateFeedbackHrQuestionPatch {
  questionIndex: number;
  recommendationText?: string;
  improvementText?: string;
  state?: HrPatchableCandidateFeedbackBlockState;
}

export interface CandidateFeedbackHrPatch {
  overall?: CandidateFeedbackHrOverallPatch;
  questions?: CandidateFeedbackHrQuestionPatch[];
}

@Injectable()
export class CandidateFeedbackService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByInterviewId(
    interviewId: string,
  ): Promise<CandidateFeedback | null> {
    const feedbackResult =
      await this.databaseService.query<CandidateFeedbackRow>(
        `
          SELECT ${CANDIDATE_FEEDBACK_COLUMNS}
          FROM candidate_feedback
          WHERE interview_id = $1
          LIMIT 1
        `,
        [interviewId],
      );

    const feedbackRow = feedbackResult.rows[0];
    if (!feedbackRow) {
      return null;
    }

    const questions = await this.loadQuestions(feedbackRow.id);
    return this.mapFeedbackRow(feedbackRow, questions);
  }

  async getOrCreate(interviewId: string): Promise<CandidateFeedback> {
    return this.databaseService.withAdvisoryLock(
      `candidate-feedback:${interviewId}`,
      async () => this.getOrCreateUnlocked(interviewId),
    );
  }

  async syncQuestionsFromInterview(
    interview: Interview,
  ): Promise<CandidateFeedback> {
    return this.databaseService.withAdvisoryLock(
      `candidate-feedback:${interview.id}`,
      async () => {
        const feedback = await this.getOrCreateUnlocked(interview.id);

        if (interview.questions.length === 0) {
          return feedback;
        }

        const values: unknown[] = [];
        const placeholders = interview.questions.map((question, index) => {
          const offset = index * 4;
          values.push(
            randomUUID(),
            feedback.id,
            index,
            question.id,
          );
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        });

        await this.databaseService.query(
          `
            INSERT INTO candidate_feedback_questions (
              id,
              candidate_feedback_id,
              question_index,
              question_id
            )
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (candidate_feedback_id, question_index) DO NOTHING
          `,
          values,
        );

        const questions = await this.loadQuestions(feedback.id);
        return this.mapFeedbackRow(
          await this.requireFeedbackRow(feedback.id),
          questions,
        );
      },
    );
  }

  async patchForHr(
    interviewId: string,
    patch: CandidateFeedbackHrPatch,
  ): Promise<CandidateFeedback> {
    return this.databaseService.withAdvisoryLock(
      `candidate-feedback:${interviewId}`,
      async () => {
        const feedback = await this.requireByInterviewId(interviewId);

        if (patch.overall && this.hasHrOverallPatchFields(patch.overall)) {
          this.assertBlockOpenForHrPatch(feedback.overallState, { interviewId });
          this.assertHrPatchableState(patch.overall.state);
          await this.updateOverallBlock(interviewId, {
            overallRecommendationText: patch.overall.recommendationText,
            overallImprovementText: patch.overall.improvementText,
            overallState: patch.overall.state,
          });
        }

        if (patch.questions?.length) {
          for (const questionPatch of patch.questions) {
            if (!this.hasHrQuestionPatchFields(questionPatch)) {
              continue;
            }

            this.assertHrPatchableState(questionPatch.state);

            const question = feedback.questions.find(
              (item) => item.questionIndex === questionPatch.questionIndex,
            );
            if (!question) {
              throw apiNotFound(
                ApiErrorCode.FEEDBACK_NOT_FOUND,
                'Candidate feedback question not found',
                {
                  interviewId,
                  questionIndex: questionPatch.questionIndex,
                },
              );
            }

            this.assertBlockOpenForHrPatch(question.state, {
              interviewId,
              questionIndex: question.questionIndex,
            });

            await this.applyQuestionBlockUpdate(question, {
              recommendationText: questionPatch.recommendationText,
              improvementText: questionPatch.improvementText,
              state: questionPatch.state,
            });
          }

          await this.touchFeedback(feedback.id);
        }

        return (await this.findByInterviewId(interviewId))!;
      },
    );
  }

  async updateOverallBlock(
    interviewId: string,
    update: CandidateFeedbackOverallBlockUpdate,
  ): Promise<CandidateFeedback> {
    const feedback = await this.requireByInterviewId(interviewId);
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [feedback.id];
    let paramIndex = 2;

    if (update.overallRecommendationText !== undefined) {
      setClauses.push(`overall_recommendation_text = $${paramIndex++}`);
      params.push(update.overallRecommendationText);
    }
    if (update.overallImprovementText !== undefined) {
      setClauses.push(`overall_improvement_text = $${paramIndex++}`);
      params.push(update.overallImprovementText);
    }
    if (update.overallState !== undefined) {
      setClauses.push(`overall_state = $${paramIndex++}`);
      params.push(update.overallState);
    }
    if (update.overallErrorMessage !== undefined) {
      setClauses.push(`overall_error_message = $${paramIndex++}`);
      params.push(update.overallErrorMessage);
    }

    if (setClauses.length === 1) {
      return feedback;
    }

    const result = await this.databaseService.query<CandidateFeedbackRow>(
      `
        UPDATE candidate_feedback
        SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING ${CANDIDATE_FEEDBACK_COLUMNS}
      `,
      params,
    );

    return this.mapFeedbackRow(result.rows[0], feedback.questions);
  }

  async updateQuestionBlock(
    interviewId: string,
    questionIndex: number,
    update: CandidateFeedbackQuestionBlockUpdate,
  ): Promise<CandidateFeedback> {
    const feedback = await this.requireByInterviewId(interviewId);
    const question = this.findQuestionBlock(feedback, interviewId, questionIndex);

    if (await this.applyQuestionBlockUpdate(question, update)) {
      await this.touchFeedback(feedback.id);
    }

    return (await this.findByInterviewId(interviewId))!;
  }

  private async applyQuestionBlockUpdate(
    question: CandidateFeedbackQuestion,
    update: CandidateFeedbackQuestionBlockUpdate,
  ): Promise<boolean> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [question.id];
    let paramIndex = 2;

    if (update.recommendationText !== undefined) {
      setClauses.push(`recommendation_text = $${paramIndex++}`);
      params.push(update.recommendationText);
    }
    if (update.improvementText !== undefined) {
      setClauses.push(`improvement_text = $${paramIndex++}`);
      params.push(update.improvementText);
    }
    if (update.state !== undefined) {
      setClauses.push(`state = $${paramIndex++}`);
      params.push(update.state);
    }
    if (update.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIndex++}`);
      params.push(update.errorMessage);
    }

    if (setClauses.length === 1) {
      return false;
    }

    await this.databaseService.query(
      `
        UPDATE candidate_feedback_questions
        SET ${setClauses.join(', ')}
        WHERE id = $1
      `,
      params,
    );

    return true;
  }

  async beginQuestionBlockGeneration(
    interviewId: string,
    questionIndex: number,
  ): Promise<boolean> {
    const feedback = await this.requireByInterviewId(interviewId);
    const question = this.findQuestionBlock(feedback, interviewId, questionIndex);

    const result = await this.databaseService.query(
      `
        UPDATE candidate_feedback_questions
        SET state = 'generating', error_message = NULL, updated_at = NOW()
        WHERE id = $1
          AND state IN ('not_generated', 'generated', 'failed')
        RETURNING id
      `,
      [question.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return false;
    }

    await this.touchFeedback(feedback.id);
    return true;
  }

  async completeQuestionBlockGeneration(
    interviewId: string,
    questionIndex: number,
    outcome:
      | {
          kind: 'generated';
          recommendationText: string;
          improvementText: string;
        }
      | { kind: 'failed'; errorMessage: string },
  ): Promise<boolean> {
    const feedback = await this.requireByInterviewId(interviewId);
    const question = this.findQuestionBlock(feedback, interviewId, questionIndex);

    const result =
      outcome.kind === 'generated'
        ? await this.databaseService.query(
            `
              UPDATE candidate_feedback_questions
              SET
                recommendation_text = $2,
                improvement_text = $3,
                state = 'generated',
                error_message = NULL,
                updated_at = NOW()
              WHERE id = $1 AND state = 'generating'
              RETURNING id
            `,
            [
              question.id,
              outcome.recommendationText,
              outcome.improvementText,
            ],
          )
        : await this.databaseService.query(
            `
              UPDATE candidate_feedback_questions
              SET
                state = 'failed',
                error_message = $2,
                updated_at = NOW()
              WHERE id = $1 AND state = 'generating'
              RETURNING id
            `,
            [question.id, outcome.errorMessage],
          );

    if ((result.rowCount ?? 0) === 0) {
      return false;
    }

    await this.touchFeedback(feedback.id);
    return true;
  }

  async beginOverallBlockGeneration(interviewId: string): Promise<boolean> {
    const feedback = await this.requireByInterviewId(interviewId);

    const result = await this.databaseService.query(
      `
        UPDATE candidate_feedback
        SET overall_state = 'generating', overall_error_message = NULL, updated_at = NOW()
        WHERE id = $1
          AND overall_state IN ('not_generated', 'generated', 'failed')
        RETURNING id
      `,
      [feedback.id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async completeOverallBlockGeneration(
    interviewId: string,
    outcome:
      | {
          kind: 'generated';
          recommendationText: string;
          improvementText: string;
        }
      | { kind: 'failed'; errorMessage: string },
  ): Promise<boolean> {
    const feedback = await this.requireByInterviewId(interviewId);

    const result =
      outcome.kind === 'generated'
        ? await this.databaseService.query(
            `
              UPDATE candidate_feedback
              SET
                overall_recommendation_text = $2,
                overall_improvement_text = $3,
                overall_state = 'generated',
                overall_error_message = NULL,
                updated_at = NOW()
              WHERE id = $1 AND overall_state = 'generating'
              RETURNING id
            `,
            [
              feedback.id,
              outcome.recommendationText,
              outcome.improvementText,
            ],
          )
        : await this.databaseService.query(
            `
              UPDATE candidate_feedback
              SET
                overall_state = 'failed',
                overall_error_message = $2,
                updated_at = NOW()
              WHERE id = $1 AND overall_state = 'generating'
              RETURNING id
            `,
            [feedback.id, outcome.errorMessage],
          );

    return (result.rowCount ?? 0) > 0;
  }

  private findQuestionBlock(
    feedback: CandidateFeedback,
    interviewId: string,
    questionIndex: number,
  ): CandidateFeedbackQuestion {
    const question = feedback.questions.find(
      (item) => item.questionIndex === questionIndex,
    );
    if (!question) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'Candidate feedback question not found',
        { interviewId, questionIndex },
      );
    }
    return question;
  }

  private async touchFeedback(feedbackId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE candidate_feedback SET updated_at = NOW() WHERE id = $1`,
      [feedbackId],
    );
  }

  private async getOrCreateUnlocked(
    interviewId: string,
  ): Promise<CandidateFeedback> {
    const existing = await this.findByInterviewId(interviewId);
    if (existing) {
      return existing;
    }

    const id = randomUUID();
    const result = await this.databaseService.query<CandidateFeedbackRow>(
      `
        INSERT INTO candidate_feedback (id, interview_id)
        VALUES ($1, $2)
        RETURNING ${CANDIDATE_FEEDBACK_COLUMNS}
      `,
      [id, interviewId],
    );

    return this.mapFeedbackRow(result.rows[0], []);
  }

  private async requireByInterviewId(
    interviewId: string,
  ): Promise<CandidateFeedback> {
    const feedback = await this.findByInterviewId(interviewId);
    if (!feedback) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'Candidate feedback not found',
        { interviewId },
      );
    }
    return feedback;
  }

  private assertHrPatchableState(
    state: HrPatchableCandidateFeedbackBlockState | undefined,
  ): void {
    if (state === undefined) {
      return;
    }
    if (!isHrPatchableCandidateFeedbackBlockState(state)) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'HR can only set block state to accepted or edited',
        { state },
      );
    }
  }

  private assertBlockOpenForHrPatch(
    state: CandidateFeedbackBlockState,
    context: { interviewId: string; questionIndex?: number },
  ): void {
    if (getHrPatchBlockReason(state) === 'in_progress') {
      throw apiConflict(
        ApiErrorCode.CONFLICT,
        'Candidate feedback generation is in progress for this block',
        context,
      );
    }
  }

  private hasHrQuestionPatchFields(
    patch: CandidateFeedbackHrQuestionPatch,
  ): boolean {
    return (
      patch.recommendationText !== undefined ||
      patch.improvementText !== undefined ||
      patch.state !== undefined
    );
  }

  private hasHrOverallPatchFields(
    patch: CandidateFeedbackHrOverallPatch,
  ): boolean {
    return (
      patch.recommendationText !== undefined ||
      patch.improvementText !== undefined ||
      patch.state !== undefined
    );
  }

  private async requireFeedbackRow(
    feedbackId: string,
  ): Promise<CandidateFeedbackRow> {
    const result = await this.databaseService.query<CandidateFeedbackRow>(
      `
        SELECT ${CANDIDATE_FEEDBACK_COLUMNS}
        FROM candidate_feedback
        WHERE id = $1
        LIMIT 1
      `,
      [feedbackId],
    );
    return result.rows[0];
  }

  private async loadQuestions(
    candidateFeedbackId: string,
  ): Promise<CandidateFeedbackQuestion[]> {
    const result =
      await this.databaseService.query<CandidateFeedbackQuestionRow>(
        `
          SELECT ${CANDIDATE_FEEDBACK_QUESTION_COLUMNS}
          FROM candidate_feedback_questions
          WHERE candidate_feedback_id = $1
          ORDER BY question_index ASC
        `,
        [candidateFeedbackId],
      );

    return result.rows.map((row) => this.mapQuestionRow(row));
  }

  private mapFeedbackRow(
    row: CandidateFeedbackRow,
    questions: CandidateFeedbackQuestion[],
  ): CandidateFeedback {
    return {
      id: row.id,
      interviewId: row.interview_id,
      overallRecommendationText: row.overall_recommendation_text ?? undefined,
      overallImprovementText: row.overall_improvement_text ?? undefined,
      overallState: row.overall_state,
      overallErrorMessage: row.overall_error_message ?? undefined,
      questions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapQuestionRow(
    row: CandidateFeedbackQuestionRow,
  ): CandidateFeedbackQuestion {
    return {
      id: row.id,
      candidateFeedbackId: row.candidate_feedback_id,
      questionIndex: row.question_index,
      questionId: row.question_id,
      recommendationText: row.recommendation_text ?? undefined,
      improvementText: row.improvement_text ?? undefined,
      state: row.state,
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
