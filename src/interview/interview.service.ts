import { Injectable, Logger } from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { MediaCleanupService } from '../upload/media-cleanup.service';
import {
  apiBadRequest,
  apiConflict,
  apiForbidden,
  apiNotFound,
} from '../common/errors/api-error';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { DEFAULT_LOCALE, isLocale, Locale } from '../locale/locale.constants';
import { QuestionService } from '../question/question.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import {
  QueryInterviewsDto,
  InterviewSortField,
  InterviewSortOrder,
} from './dto/query-interviews.dto';
import { QueryInterviewFacetsDto } from './dto/query-interview-facets.dto';
import { matchesInterviewMediaKey } from '../upload/upload-key';
import {
  Answer,
  AnswerBehaviorEvent,
  AnswerBehaviorSignals,
  AnswerEvaluation,
  AnswerTranscript,
  AnswerValidation,
  AnswerVersion,
  Interview,
  InterviewBehaviorRisk,
  InterviewDecision,
  InterviewQuestion,
  InterviewResult,
  InterviewQuestionResult,
  InterviewWorkflow,
  MediaArtifact,
  InterviewCancelResult,
  InterviewDeleteResult,
  InterviewListItem,
  InterviewActor,
} from './interfaces/interview.interface';
import { compareBehaviorRisk } from './answer-behavior-risk';
import {
  getAnswerAttemptLimitBlockReason,
  getAnswerVersionNotReservedBlockReason,
  getAnswerVersionOverwriteBlockReason,
  getRecordingSessionLockBlockReason,
  resolveMaxAnswerAttemptsPerQuestion,
} from './answer-attempt-rules';
import {
  getInterviewCompletionBlockReason,
  getSubmittedAnswerCount as countSubmittedAnswers,
} from './interview-completion-rules';
import { getInterviewResultsUnavailableMessage } from './interview-results-rules';
import {
  getInterviewAccessDenialReason,
  getDemoScopeDenialReason,
  INTERVIEW_ACCESS_DENIED_MESSAGE,
} from './interview-access-rules';
import { assertActorCanSetAssignedHr } from './interview-assignment-rules';
import {
  getInterviewTerminalOnlyBlockReason,
  getInterviewPendingOnlyBlockReason,
  getInterviewPendingOnlyBlockReasonForFields,
  getInterviewDemoDeleteBlockReason,
  hasInterviewPendingOnlyFieldUpdates,
  isTerminalInterviewStatus,
} from './interview-management-rules';
import { buildFeedbackImprovements } from '../feedback/feedback-text';
import { buildInterviewSummary } from './build-interview-summary';
import {
  collectInterviewLocaleWarnings,
  InterviewLocaleWarning,
} from './interview-locale-warnings';
import { isDemoSeedAllowed, upsertDemoUser } from '../database/demo-seed-core';
import {
  DEMO_PLACEHOLDER_INTERVIEW_ID,
  DEMO_USER_ID,
} from '../database/demo-seed-data';
import { buildInterviewFilterClauses } from './interview-list-filters';
import { fromInterviewListRow, InterviewListRow } from './interview-list-item';

export const DEFAULT_INTERVIEWS_PAGE = 1;
export const DEFAULT_INTERVIEWS_LIMIT = 20;
export const MAX_INTERVIEWS_LIMIT = 100;
export const DEFAULT_INTERVIEWS_SORT_BY: InterviewSortField = 'updatedAt';
export const DEFAULT_INTERVIEWS_SORT_ORDER: InterviewSortOrder = 'desc';

const SORT_FIELD_TO_SQL: Record<InterviewSortField, string> = {
  candidateName: 'lower(i.candidate_name)',
  createdAt: 'i.created_at',
  updatedAt: 'i.updated_at',
};

export interface PaginatedInterviews {
  items: InterviewListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface InterviewFacets {
  totalQuestionCount: number;
  positions: FacetCount[];
  statuses: FacetCount[];
}

export type { InterviewFacetFields } from './interview-list-filters';

const DEFAULT_INTERVIEW_LIST_LIMIT = 50;
const MAX_INTERVIEW_LIST_LIMIT = 100;

export type { InterviewLocaleWarning } from './interview-locale-warnings';

export interface CreateInterviewResult {
  interview: Interview;
  localeWarnings: InterviewLocaleWarning[];
}

export type InterviewResultWithLocale = InterviewResult & {
  interviewLocale: Locale;
};

const INTERVIEW_TABLE_COLUMNS = `
  id,
  candidate_name,
  candidate_email,
  position,
  interview_locale,
  questions_json,
  answers_json,
  status,
  result_json,
  workflow_json,
  created_by_id,
  assigned_hr_id,
  demo,
  created_at,
  updated_at
`;

const INTERVIEW_SELECT_COLUMNS = `
  i.id,
  i.candidate_name,
  i.candidate_email,
  i.position,
  i.interview_locale,
  i.questions_json,
  i.answers_json,
  i.status,
  i.result_json,
  i.workflow_json,
  i.created_by_id,
  i.assigned_hr_id,
  i.demo,
  i.created_at,
  i.updated_at,
  ah.name AS assigned_hr_name,
  ah.email AS assigned_hr_email
`;

const INTERVIEW_SELECT_FROM = `
  FROM interviews i
  LEFT JOIN users ah ON ah.id = i.assigned_hr_id
`;

const INTERVIEW_LIST_SELECT_COLUMNS = `
  i.id,
  i.candidate_name,
  i.candidate_email,
  i.position,
  i.status,
  i.created_at,
  i.updated_at,
  COALESCE(jsonb_array_length(i.questions_json), 0) AS question_count,
  (
    SELECT COUNT(*)::int
    FROM jsonb_array_elements(COALESCE(i.answers_json, '[]'::jsonb)) AS answer(value)
    WHERE answer.value->>'status' = 'submitted'
  ) AS submitted_answer_count,
  CASE
    WHEN i.result_json IS NULL THEN NULL
    ELSE COALESCE((i.result_json->>'overallScore')::double precision, 0)
  END AS overall_score,
  i.result_json->>'decision' AS decision,
  i.assigned_hr_id,
  ah.name AS assigned_hr_name,
  ah.email AS assigned_hr_email
`;

const INTERVIEW_UPDATE_SQL = `
  UPDATE interviews
  SET
    candidate_name = $2,
    candidate_email = $3,
    position = $4,
    questions_json = $5::jsonb,
    answers_json = $6::jsonb,
    status = $7,
    result_json = $8::jsonb,
    workflow_json = $9::jsonb,
    assigned_hr_id = $10,
    updated_at = NOW()
  WHERE id = $1
  RETURNING ${INTERVIEW_TABLE_COLUMNS}
`;

const INTERVIEW_UPDATE_WITH_ASSIGNEE_SQL = `
  WITH updated AS (
    ${INTERVIEW_UPDATE_SQL.trim()}
  )
  SELECT ${INTERVIEW_SELECT_COLUMNS}
  FROM updated i
  LEFT JOIN users ah ON ah.id = i.assigned_hr_id
`;

interface InterviewRow {
  id: string;
  candidate_name: string;
  candidate_email: string | null;
  position: string;
  interview_locale: string;
  questions_json: InterviewQuestion[] | null;
  answers_json: Record<string, unknown>[] | null;
  status: Interview['status'];
  result_json: Record<string, unknown> | null;
  workflow_json: Record<string, unknown> | null;
  created_by_id: string | null;
  assigned_hr_id: string | null;
  assigned_hr_name?: string | null;
  assigned_hr_email?: string | null;
  demo: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AddAnswerInput {
  questionIndex: number;
  versionNumber: number;
  submitAnswer: boolean;
  mediaKey: string;
  screenMediaKey?: string;
  durationSeconds?: number;
  startedAt?: Date;
  submittedAt?: Date;
  cameraFileSizeBytes?: number;
  screenFileSizeBytes?: number;
  behaviorSignals?: AnswerBehaviorSignals;
  behaviorEvents?: AnswerBehaviorEvent[];
  clientTranscript?: AnswerTranscript;
  recordingSessionId: string;
}

interface SaveAnswerProgressInput {
  questionIndex: number;
  versionNumber: number;
  mediaKey: string;
  screenMediaKey?: string;
  durationSeconds?: number;
  startedAt?: Date;
  submittedAt?: Date;
  cameraFileSizeBytes?: number;
  screenFileSizeBytes?: number;
  behaviorSignals?: AnswerBehaviorSignals;
  behaviorEvents?: AnswerBehaviorEvent[];
  clientTranscript?: AnswerTranscript;
  recordingSessionId: string;
}

interface ReserveAnswerAttemptInput {
  questionIndex: number;
  recordingSessionId: string;
}

export interface ReserveAnswerAttemptResult {
  versionNumber: number;
  versionCount: number;
  selectedVersionNumber: number;
  status: Answer['status'];
  maxAttempts: number;
}

interface QueueAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber: number;
  runId: string;
  executionArn?: string;
  requestedAt: Date;
}

interface CompleteAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber: number;
  runId: string;
  requestedAt: Date;
  executionArn?: string;
  transcript?: AnswerTranscript;
  evaluation?: AnswerEvaluation;
  completedAt: Date;
}

interface FailAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber?: number;
  runId?: string;
  executionArn?: string;
  errorMessage?: string;
  completedAt: Date;
}

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly questionService: QuestionService,
    private readonly mediaCleanupService: MediaCleanupService,
  ) {}

  async create(
    dto: CreateInterviewDto,
    context: { createdById?: string; demo?: boolean; actor: InterviewActor },
  ): Promise<CreateInterviewResult> {
    const candidateName = dto.candidateName.trim();
    const position = dto.position.trim();
    const questionIds = dto.questionIds.map((id) => id.trim()).filter(Boolean);

    if (!candidateName) {
      throw apiBadRequest(ApiErrorCode.BAD_REQUEST, 'Candidate name is required');
    }
    if (!position) {
      throw apiBadRequest(ApiErrorCode.BAD_REQUEST, 'Position is required');
    }
    if (questionIds.length === 0) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'At least one question must be selected',
      );
    }

    const interviewLocale = dto.interviewLocale ?? DEFAULT_LOCALE;

    return this.databaseService.withTransaction(async (client) => {
      assertActorCanSetAssignedHr(context.actor, dto.assignedHrId);

      let assignedHrId: string | null = null;

      if (context.actor.role === 'hr') {
        assignedHrId = context.actor.id;
      } else if (dto.assignedHrId) {
        await this.assertAssignableHrUser(
            client,
            dto.assignedHrId,
            context.demo === true,
        );
        assignedHrId = dto.assignedHrId;
      }

      const questions = await this.questionService.findManyByIdsForUpdate(
        client,
        questionIds,
        context.demo === true,
        { rejectPendingDeletionFor: questionIds },
      );

      if (questions.length !== questionIds.length) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          `Resolved ${questions.length} questions for ${questionIds.length} requested ids; interview cannot be created.`,
        );
      }

      const localeWarnings = collectInterviewLocaleWarnings(
        questions,
        interviewLocale,
      );

      const result = await client.query<InterviewRow>(
        `
          WITH inserted AS (
            INSERT INTO interviews (
              id,
              candidate_name,
              candidate_email,
              position,
              interview_locale,
              questions_json,
              answers_json,
              status,
              workflow_json,
              created_by_id,
              assigned_hr_id,
              demo
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11, $12)
            RETURNING ${INTERVIEW_TABLE_COLUMNS}
          )
          SELECT ${INTERVIEW_SELECT_COLUMNS}
          FROM inserted i
          LEFT JOIN users ah ON ah.id = i.assigned_hr_id
        `,
        [
          randomUUID(),
          candidateName,
          dto.candidateEmail?.trim().toLowerCase() || null,
          position,
          interviewLocale,
          JSON.stringify(questions),
          JSON.stringify([]),
          'pending',
          JSON.stringify(this.buildWorkflow('idle', new Date())),
          context.createdById ?? null,
          assignedHrId,
          context.demo === true,
        ],
      );

      await client.query(
        `UPDATE questions SET usage_count = usage_count + 1 WHERE id = ANY($1::uuid[])`,
        [questionIds],
      );

      // Popularity is recorded here, atomically with the interview, when the
      // client started from a template. Best-effort and demo-scoped: a stale or
      // out-of-scope templateId leaves the interview untouched rather than failing it.
      const templateId = dto.templateId?.trim();
      if (templateId) {
        await client.query(
          `UPDATE interview_templates
              SET usage_count = usage_count + 1, updated_at = NOW()
            WHERE id = $1 AND demo = $2`,
          [templateId, context.demo === true],
        );
      }

      return {
        interview: this.mapRow(result.rows[0]),
        localeWarnings,
      };
    });
  }

  async cancel(id: string, actor: InterviewActor): Promise<InterviewCancelResult> {
    return this.databaseService.withTransaction(async (client) => {
      const row = await this.lockInterviewForUpdate(client, id);
      const interview = this.mapRow(row);
      this.assertActorCanManageInterview(interview, actor);

      const blockReason = getInterviewPendingOnlyBlockReason(interview.status);
      if (blockReason) {
        throw apiConflict(ApiErrorCode.CONFLICT, blockReason, {
          interviewId: id,
          status: interview.status,
        });
      }

      await this.removeInterview(client, interview);
      return { id, canceled: true };
    });
  }

  async deleteCompleted(
    id: string,
    actor: InterviewActor,
  ): Promise<InterviewDeleteResult> {
    const result = await this.databaseService.withTransaction(async (client) => {
      const row = await this.lockInterviewForUpdate(client, id);
      const interview = this.mapRow(row);
      this.assertActorCanManageInterview(interview, actor);

      const blockReason = getInterviewTerminalOnlyBlockReason(interview.status);
      if (blockReason) {
        throw apiConflict(ApiErrorCode.CONFLICT, blockReason, {
          interviewId: id,
          status: interview.status,
        });
      }

      const demoBlockReason = getInterviewDemoDeleteBlockReason(interview);
      if (demoBlockReason) {
        throw apiForbidden(ApiErrorCode.FORBIDDEN, demoBlockReason, {
          interviewId: id,
        });
      }

      await this.removeInterview(client, interview);
      return { id, deleted: true as const };
    });

    await this.purgeInterviewMediaBestEffort(id);
    return result;
  }

  private async purgeInterviewMediaBestEffort(interviewId: string): Promise<void> {
    try {
      await this.mediaCleanupService.deleteInterviewMedia(interviewId);
    } catch (error) {
      this.logger.error(
        `Best-effort S3 cleanup failed after interview ${interviewId} was deleted`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async removeInterview(
    client: PoolClient,
    interview: Interview,
  ): Promise<void> {
    const questionIds = interview.questions.map((question) => question.id);
    await client.query(`DELETE FROM interviews WHERE id = $1`, [interview.id]);
    if (questionIds.length > 0) {
      await client.query(
        `UPDATE questions SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = ANY($1::uuid[])`,
        [questionIds],
      );
    }

    await this.questionService.processPendingDeletionsAfterTerminalInterview(
      client,
      questionIds,
    );
  }

  async update(
    id: string,
    dto: UpdateInterviewDto,
    actor: InterviewActor,
  ): Promise<Interview> {
    const hasUpdates =
      hasInterviewPendingOnlyFieldUpdates(dto) ||
      dto.assignedHrId !== undefined;

    if (!hasUpdates) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'At least one field must be provided',
      );
    }

    return this.databaseService.withTransaction(async (client) => {
      assertActorCanSetAssignedHr(actor, dto.assignedHrId);

      const row = await this.lockInterviewForUpdate(client, id);
      const interview = this.mapRow(row);
      this.assertActorCanManageInterview(interview, actor);

      const blockReason = getInterviewPendingOnlyBlockReasonForFields(
        interview.status,
        hasInterviewPendingOnlyFieldUpdates(dto),
      );
      if (blockReason) {
        throw apiConflict(ApiErrorCode.CONFLICT, blockReason, {
          interviewId: id,
          status: interview.status,
        });
      }

      let candidateName = interview.candidateName;
      let candidateEmail = interview.candidateEmail;
      let position = interview.position;
      let questions = interview.questions;
      let assignedHrId = interview.assignedHrId;

      if (dto.candidateName !== undefined) {
        candidateName = dto.candidateName.trim();
        if (!candidateName) {
          throw apiBadRequest(ApiErrorCode.BAD_REQUEST, 'Candidate name is required');
        }
      }

      if (dto.position !== undefined) {
        position = dto.position.trim();
        if (!position) {
          throw apiBadRequest(ApiErrorCode.BAD_REQUEST, 'Position is required');
        }
      }

      if (dto.candidateEmail !== undefined) {
        candidateEmail = dto.candidateEmail.trim().toLowerCase() || undefined;
      }

      if (dto.assignedHrId !== undefined) {
        if (dto.assignedHrId === null) {
          assignedHrId = undefined;
        } else {
          await this.assertAssignableHrUser(
            client,
            dto.assignedHrId,
            interview.demo === true,
          );
          assignedHrId = dto.assignedHrId;
        }
      }

      if (dto.questionIds !== undefined) {
        const questionIds = dto.questionIds
          .map((questionId) => questionId.trim())
          .filter(Boolean);

        if (questionIds.length === 0) {
          throw apiBadRequest(
            ApiErrorCode.BAD_REQUEST,
            'At least one question must be selected',
          );
        }

        const oldIds = interview.questions.map((question) => question.id);
        const added = questionIds.filter((questionId) => !oldIds.includes(questionId));
        const removed = oldIds.filter((questionId) => !questionIds.includes(questionId));

        const nextQuestions = await this.questionService.findManyByIdsForUpdate(
          client,
          questionIds,
          interview.demo === true,
          { rejectPendingDeletionFor: added },
        );

        if (added.length > 0) {
          await client.query(
            `UPDATE questions SET usage_count = usage_count + 1 WHERE id = ANY($1::uuid[])`,
            [added],
          );
        }

        if (removed.length > 0) {
          await client.query(
            `UPDATE questions SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = ANY($1::uuid[])`,
            [removed],
          );
        }

        questions = nextQuestions;
      }

      const updated: Interview = {
        ...interview,
        candidateName,
        candidateEmail,
        position,
        assignedHrId,
        questions,
        updatedAt: new Date(),
      };

      const saved = await this.saveInterviewInTransaction(client, updated);
      return saved;
    });
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    page?: number;
  }): Promise<{ items: Interview[]; total: number; page: number; limit: number }> {
    const limit = Math.min(MAX_INTERVIEW_LIST_LIMIT,
      Math.max(1, options?.limit ?? DEFAULT_INTERVIEW_LIST_LIMIT),
    );
    const page = Math.max(1, options?.page ?? 1);
    const offset = Math.max(0, options?.offset ?? (page - 1) * limit);

    const [countResult, result] = await Promise.all([
      this.databaseService.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM interviews`,
        [],
      ),
      this.databaseService.query<InterviewRow>(
        `
          SELECT ${INTERVIEW_SELECT_COLUMNS}
          ${INTERVIEW_SELECT_FROM}
          ORDER BY i.created_at DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      ),
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    return {
      items: result.rows.map((row) => this.mapRow(row)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Interview> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        SELECT ${INTERVIEW_SELECT_COLUMNS}
        ${INTERVIEW_SELECT_FROM}
        WHERE i.id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw apiNotFound(
        ApiErrorCode.INTERVIEW_NOT_FOUND,
        `Interview with id "${id}" not found`,
        { id },
      );
    }

    return this.mapRow(result.rows[0]);
  }

  private assertActorCanList(actor: InterviewActor): void {
    if (
      actor.role !== 'super_admin' &&
      actor.role !== 'admin' &&
      actor.role !== 'hr'
    ) {
      throw apiForbidden(
        ApiErrorCode.INSUFFICIENT_PERMISSIONS,
        'You do not have access to interviews',
      );
    }
  }

  async findAllPaginated(
    query: QueryInterviewsDto = {},
    actor: InterviewActor,
  ): Promise<PaginatedInterviews> {
    this.assertActorCanList(actor);

    const page = Math.max(1, query.page ?? DEFAULT_INTERVIEWS_PAGE);
    const limit = Math.min(
      MAX_INTERVIEWS_LIMIT,
      Math.max(1, query.limit ?? DEFAULT_INTERVIEWS_LIMIT),
    );
    const offset = (page - 1) * limit;

    const sortBy = query.sortBy ?? DEFAULT_INTERVIEWS_SORT_BY;
    const sortOrder =
      (query.sortOrder ?? DEFAULT_INTERVIEWS_SORT_ORDER) === 'asc'
        ? 'ASC'
        : 'DESC';
    const sortExpression = SORT_FIELD_TO_SQL[sortBy];

    const { whereSql, params } = buildInterviewFilterClauses(query, actor);

    const countSql = `
      SELECT COUNT(*)::text AS total
      FROM interviews i
      ${whereSql}
    `;

    const dataParams = [...params, limit, offset];
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const dataSql = `
      SELECT ${INTERVIEW_LIST_SELECT_COLUMNS}
      FROM interviews i
      LEFT JOIN users ah ON ah.id = i.assigned_hr_id
      ${whereSql}
      ORDER BY ${sortExpression} ${sortOrder}, i.id ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const [countResult, result] = await Promise.all([
      this.databaseService.query<{ total: string }>(countSql, params),
      this.databaseService.query<InterviewListRow>(dataSql, dataParams),
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const items = result.rows.map((row) => fromInterviewListRow(row));

    return { items, total, page, limit };
  }

  async getFacets(
    query: QueryInterviewFacetsDto = {},
    actor: InterviewActor,
  ): Promise<InterviewFacets> {
    this.assertActorCanList(actor);

    const [totalQuestionCount, positions, statuses] = await Promise.all([
      this.queryInterviewTotalQuestionCount(query, actor),
      this.queryInterviewPositionFacet(query, actor),
      this.queryInterviewStatusFacet(query, actor),
    ]);

    return { totalQuestionCount, positions, statuses };
  }

  private async queryInterviewTotalQuestionCount(
    query: QueryInterviewFacetsDto,
    actor: InterviewActor,
  ): Promise<number> {
    const { whereSql, params } = buildInterviewFilterClauses(query, actor);

    const result = await this.databaseService.query<{ total: string }>(
      `
        SELECT COALESCE(
          SUM(COALESCE(jsonb_array_length(i.questions_json), 0)),
          0
        )::text AS total
        FROM interviews i
        ${whereSql}
      `,
      params,
    );

    return Number(result.rows[0]?.total ?? 0);
  }

  private async queryInterviewPositionFacet(
    query: QueryInterviewFacetsDto,
    actor: InterviewActor,
  ): Promise<FacetCount[]> {
    const { whereSql, params } = buildInterviewFilterClauses(query, actor, {
      excludeField: 'position',
    });

    const result = await this.databaseService.query<{
      value: string;
      count: string;
    }>(
      `
        SELECT MIN(i.position) AS value, COUNT(*)::text AS count
        FROM interviews i
        ${whereSql}
        ${whereSql ? 'AND' : 'WHERE'} i.position IS NOT NULL AND trim(i.position) <> ''
        GROUP BY lower(i.position)
        ORDER BY COUNT(*) DESC, MIN(i.position) ASC
      `,
      params,
    );

    return result.rows.map((row) => ({
      value: row.value,
      count: Number(row.count),
    }));
  }

  private async queryInterviewStatusFacet(
    query: QueryInterviewFacetsDto,
    actor: InterviewActor,
  ): Promise<FacetCount[]> {
    const { whereSql, params } = buildInterviewFilterClauses(query, actor, {
      excludeField: 'status',
    });

    const result = await this.databaseService.query<{
      value: string;
      count: string;
    }>(
      `
        SELECT i.status AS value, COUNT(*)::text AS count
        FROM interviews i
        ${whereSql}
        ${whereSql ? 'AND' : 'WHERE'} i.status IS NOT NULL
        GROUP BY i.status
        ORDER BY COUNT(*) DESC, i.status ASC
      `,
      params,
    );

    return result.rows.map((row) => ({
      value: row.value,
      count: Number(row.count),
    }));
  }

  async findOneForActor(id: string, actor: InterviewActor): Promise<Interview> {
    const interview = await this.findOne(id);
    this.assertActorCanAccess(interview, actor);
    this.assertActorDemoScope(interview, actor);
    return interview;
  }

  private assertActorDemoScope(
    interview: Interview,
    actor: InterviewActor,
  ): void {
    const denial = getDemoScopeDenialReason(interview, actor);
    if (denial) {
      throw apiForbidden(
        ApiErrorCode.INSUFFICIENT_PERMISSIONS,
        INTERVIEW_ACCESS_DENIED_MESSAGE,
        { interviewId: interview.id },
      );
    }
  }

  async complete(id: string): Promise<Interview> {
    const interview = await this.findOne(id);
    const blockReason = getInterviewCompletionBlockReason(interview);
    if (blockReason) {
      throw apiBadRequest(ApiErrorCode.BAD_REQUEST, blockReason, {
        interviewId: id,
      });
    }

    return this.recomputeResult(id);
  }

  async getResults(id: string): Promise<InterviewResultWithLocale> {
    const interview = await this.findOne(id);
    const unavailableMessage = getInterviewResultsUnavailableMessage(
      interview,
      id,
    );
    if (unavailableMessage) {
      throw apiNotFound(ApiErrorCode.NOT_FOUND, unavailableMessage, {
        id,
        status: interview.status,
      });
    }
    return {
      ...interview.result!,
      interviewLocale: interview.interviewLocale,
    };
  }

  /**
   * Admin-only: flips the given interview to demo and reassigns it to the demo
   * account so the read-only demo shows a real completed interview. Gated by
   * isDemoSeedAllowed so it can never touch production data by accident. Keeps a
   * single completed demo interview: it deletes the fabricated placeholder and
   * demotes any other interview previously marked as the demo. The whole swap
   * runs in one transaction so the demo can never be left in a half-updated
   * state.
   */
  async markAsDemo(interviewId: string): Promise<{
    ok: true;
    interviewId: string;
    placeholderRemoved: boolean;
  }> {
    if (!isDemoSeedAllowed()) {
      throw apiForbidden(
        ApiErrorCode.FORBIDDEN,
        'Demo marking is disabled in this environment. Set ' +
          'ALLOW_DEMO_SEED=true on the backend to enable it (never on production).',
      );
    }

    return this.databaseService.withTransaction(async (client) => {
      await upsertDemoUser(client);

      const update = await client.query(
        `UPDATE interviews SET demo = true, created_by_id = $2, updated_at = NOW() WHERE id = $1`,
        [interviewId, DEMO_USER_ID],
      );
      if (update.rowCount === 0) {
        throw apiNotFound(
          ApiErrorCode.INTERVIEW_NOT_FOUND,
          `Interview ${interviewId} not found`,
          { interviewId },
        );
      }

      let placeholderRemoved = false;
      if (interviewId !== DEMO_PLACEHOLDER_INTERVIEW_ID) {
        const removal = await client.query(
          `DELETE FROM interviews WHERE id = $1`,
          [DEMO_PLACEHOLDER_INTERVIEW_ID],
        );
        placeholderRemoved = (removal.rowCount ?? 0) > 0;
      }

      await client.query(
        `UPDATE interviews SET demo = false WHERE demo = true AND status = 'completed' AND id <> $1`,
        [interviewId],
      );

      return { ok: true as const, interviewId, placeholderRemoved };
    });
  }

  private assertActorCanManageInterview(
    interview: Interview,
    actor: InterviewActor,
  ): void {
    this.assertActorCanAccess(interview, actor);
    this.assertActorDemoScope(interview, actor);
  }

  private assertActorCanAccess(
    interview: Interview,
    actor: InterviewActor,
  ): void {
    const denial = getInterviewAccessDenialReason(interview, actor);
    if (denial) {
      throw apiForbidden(
        ApiErrorCode.INSUFFICIENT_PERMISSIONS,
        INTERVIEW_ACCESS_DENIED_MESSAGE,
        { interviewId: interview.id },
      );
    }
  }

  async addAnswer(
    id: string,
    input: AddAnswerInput,
  ): Promise<Interview> {
    return this.persistAnswerVersion(id, input, {
      mergeBehaviorEvents: false,
      preserveLatestSelectedVersion: false,
      submittedAtFallback: 'now',
    });
  }

  async saveAnswerProgress(
    id: string,
    input: SaveAnswerProgressInput,
  ): Promise<Interview> {
    return this.persistAnswerVersion(
      id,
      {
        ...input,
        submitAnswer: false,
      },
      {
        mergeBehaviorEvents: true,
        preserveLatestSelectedVersion: true,
        submittedAtFallback: 'keep',
      },
    );
  }

  async reserveAnswerAttempt(
    id: string,
    input: ReserveAnswerAttemptInput,
  ): Promise<ReserveAnswerAttemptResult> {
    const { questionIndex, recordingSessionId } = input;
    const maxAttempts = resolveMaxAnswerAttemptsPerQuestion();

    return this.databaseService.withTransaction(async (client) => {
      const row = await this.lockInterviewForUpdate(client, id);
      const interview = this.mapRow(row);

      const currentQuestionIndex = this.getSubmittedAnswerCount(interview);
      if (questionIndex !== currentQuestionIndex) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Invalid question index — must answer in order',
          { interviewId: id, questionIndex, currentQuestionIndex },
        );
      }
      if (questionIndex >= interview.questions.length) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Question index is out of range',
          { interviewId: id, questionIndex },
        );
      }

      const question = interview.questions[questionIndex];
      const existingAnswer =
        interview.answers.find((answer) => answer.questionIndex === questionIndex) ??
        undefined;
      if (existingAnswer?.status === 'submitted') {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Cannot reserve a recording attempt for a submitted answer',
          { interviewId: id, questionIndex },
        );
      }

      const existingVersions = this.getAnswerVersions(existingAnswer);
      const versionNumber =
        existingVersions.reduce(
          (max, version) => Math.max(max, version.versionNumber),
          0,
        ) + 1;
      const attemptLimitReason = getAnswerAttemptLimitBlockReason(
        existingVersions.map((version) => ({
          versionNumber: version.versionNumber,
        })),
        versionNumber,
      );
      if (attemptLimitReason) {
        throw apiBadRequest(
          ApiErrorCode.ANSWER_ATTEMPT_LIMIT_REACHED,
          attemptLimitReason,
          { interviewId: id, questionIndex, versionNumber },
        );
      }

      const reservedAt = new Date();
      const stubVersion: AnswerVersion = {
        versionNumber,
        mediaKey: '',
        reservedAt,
        uploadedAt: reservedAt,
      };
      const nextVersions = [...existingVersions, stubVersion].sort(
        (left, right) => left.versionNumber - right.versionNumber,
      );
      const lockedRecordingSessionId =
        existingAnswer?.recordingSessionId ?? recordingSessionId;
      const selectedVersion =
        nextVersions.find((version) => version.versionNumber === versionNumber) ??
        stubVersion;

      const nextAnswer: Answer = {
        questionIndex,
        questionId: question.id,
        status: 'recording',
        mediaKey: selectedVersion.mediaKey,
        screenMediaKey: selectedVersion.screenMediaKey,
        uploadedAt: selectedVersion.uploadedAt ?? reservedAt,
        durationSeconds: selectedVersion.durationSeconds,
        retakeCount: Math.max(nextVersions.length - 1, 0),
        startedAt: selectedVersion.startedAt,
        submittedAt: selectedVersion.submittedAt,
        camera: selectedVersion.camera,
        screen: selectedVersion.screen,
        behaviorSignals: selectedVersion.behaviorSignals,
        selectedVersionNumber: versionNumber,
        versions: nextVersions,
        behaviorEvents: selectedVersion.behaviorEvents,
        transcript: existingAnswer?.transcript,
        evaluation: existingAnswer?.evaluation,
        validation: existingAnswer?.validation,
        recordingSessionId: lockedRecordingSessionId,
      };

      const nextAnswers = existingAnswer
        ? interview.answers.map((answer) =>
            answer.questionIndex === questionIndex ? nextAnswer : answer,
          )
        : [...interview.answers, nextAnswer].sort(
            (left, right) => left.questionIndex - right.questionIndex,
          );

      const now = new Date();
      const saved = await this.saveInterviewInTransaction(client, {
        ...interview,
        answers: nextAnswers,
        status: 'in_progress',
        workflow: this.buildWorkflow('idle', now, {
          startedAt: interview.workflow?.startedAt,
        }),
        updatedAt: now,
      });

      const savedAnswer = saved.answers.find(
        (answer) => answer.questionIndex === questionIndex,
      );

      return {
        versionNumber,
        versionCount: savedAnswer?.versions?.length ?? nextVersions.length,
        selectedVersionNumber:
          savedAnswer?.selectedVersionNumber ?? versionNumber,
        status: savedAnswer?.status ?? 'recording',
        maxAttempts,
      };
    });
  }

  async queueAnswerValidation(
    id: string,
    input: QueueAnswerValidationInput,
  ): Promise<Interview> {
    return this.queueAnswerValidations(id, [input]);
  }

  async queueAnswerValidations(
    id: string,
    inputs: QueueAnswerValidationInput[],
  ): Promise<Interview> {
    if (inputs.length === 0) {
      throw new Error('queueAnswerValidations requires at least one input.');
    }

    const interview = await this.findOne(id);
    const inputByIndex = new Map(
      inputs.map((input) => [input.questionIndex, input]),
    );

    inputByIndex.forEach((_value, questionIndex) =>
      this.requireAnswer(interview, questionIndex),
    );

    const stamps = inputs.map((input) => new Date(input.requestedAt));
    const earliest = stamps.reduce((acc, candidate) =>
      candidate.getTime() < acc.getTime() ? candidate : acc,
    );

    const updatedAnswers = interview.answers.map((answer) => {
      const input = inputByIndex.get(answer.questionIndex);
      if (!input) return answer;
      const stamp = new Date(input.requestedAt);
      return {
        ...answer,
        validation: {
          status: 'queued' as const,
          executionArn: input.executionArn,
          sourceVersionNumber: input.sourceVersionNumber,
          runId: input.runId,
          requestedAt: stamp,
          startedAt: stamp,
          errorMessage: undefined,
        },
      };
    });

    return this.saveInterview({
      ...interview,
      answers: updatedAnswers,
      status: 'processing',
      workflow: this.buildWorkflow('processing', earliest, {
        currentStage: 'validate_answers',
        startedAt: interview.workflow?.startedAt ?? earliest,
        errorMessage: undefined,
      }),
      updatedAt: earliest,
    });
  }

  async completeAnswerValidation(
    id: string,
    input: CompleteAnswerValidationInput,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const answer = this.requireAnswer(interview, input.questionIndex);

    if (this.isStaleValidationWrite(answer, input.runId)) {
      return interview;
    }

    const nextAnswer: Answer = {
      ...answer,
      transcript: this.mergeTranscript(answer.transcript, input.transcript),
      evaluation: input.evaluation ?? answer.evaluation,
      validation: {
        status: 'completed',
        executionArn:
          input.executionArn ?? answer.validation?.executionArn,
        sourceVersionNumber: input.sourceVersionNumber,
        runId: input.runId,
        requestedAt:
          answer.validation?.requestedAt ?? input.completedAt,
        startedAt:
          answer.validation?.startedAt ?? input.completedAt,
        completedAt: input.completedAt,
      },
    };

    const withUpdatedAnswer: Interview = {
      ...interview,
      answers: interview.answers.map((item) =>
        item.questionIndex === nextAnswer.questionIndex ? nextAnswer : item,
      ),
      updatedAt: new Date(),
    };

    const next = this.applyResultRecomputation(withUpdatedAnswer);
    return this.saveInterviewWithTerminalSideEffects(interview.status, next);
  }

  private isStaleValidationWrite(
    answer: Answer,
    inputRunId: string | undefined,
  ): boolean {
    if (!inputRunId) return false;
    const existingRunId = answer.validation?.runId;
    if (!existingRunId) {
      const existingStatus = answer.validation?.status;
      return existingStatus !== 'queued' && existingStatus !== 'processing';
    }
    return existingRunId !== inputRunId;
  }

  async failAnswerValidation(
    id: string,
    input: FailAnswerValidationInput,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const answer = this.requireAnswer(interview, input.questionIndex);

    if (this.isStaleValidationWrite(answer, input.runId)) {
      return interview;
    }

    const nextAnswer: Answer = {
      ...answer,
      validation: {
        status: 'failed',
        executionArn:
          input.executionArn ?? answer.validation?.executionArn,
        sourceVersionNumber:
          input.sourceVersionNumber ?? answer.validation?.sourceVersionNumber,
        runId: input.runId ?? answer.validation?.runId,
        requestedAt:
          answer.validation?.requestedAt ?? input.completedAt,
        startedAt:
          answer.validation?.startedAt ?? answer.validation?.requestedAt,
        completedAt: input.completedAt,
        errorMessage:
          input.errorMessage ??
          answer.validation?.errorMessage ??
          'Answer validation failed',
      },
    };

    const now = new Date(input.completedAt);
    const updatedAnswers = interview.answers.map((item) =>
      item.questionIndex === nextAnswer.questionIndex ? nextAnswer : item,
    );

    const submittedAnswers = updatedAnswers.filter((a) => a.status === 'submitted');
    const allFailed =
      submittedAnswers.length > 0 &&
      submittedAnswers.every((a) => a.validation?.status === 'failed');

    const nextStatus = allFailed ? 'failed' : interview.status;
    const nextWorkflow = allFailed
      ? this.buildWorkflow('failed', now, {
          currentStage: 'analyze_answers',
          startedAt:
            answer.validation?.startedAt ??
            answer.validation?.requestedAt ??
            now,
          completedAt: now,
          errorMessage: nextAnswer.validation?.errorMessage,
        })
      : interview.workflow;

    const next = this.applyResultRecomputation({
      ...interview,
      answers: updatedAnswers,
      status: nextStatus,
      workflow: nextWorkflow,
      updatedAt: now,
    });
    return this.saveInterviewWithTerminalSideEffects(interview.status, next);
  }

  private async persistAnswerVersion(
    id: string,
    input: AddAnswerInput,
    options: {
      mergeBehaviorEvents: boolean;
      preserveLatestSelectedVersion: boolean;
      submittedAtFallback: 'now' | 'keep';
    },
  ): Promise<Interview> {
    const {
      questionIndex,
      versionNumber,
      submitAnswer,
      mediaKey,
      screenMediaKey,
      durationSeconds,
      startedAt,
      submittedAt,
      cameraFileSizeBytes,
      screenFileSizeBytes,
      behaviorSignals,
      behaviorEvents,
      clientTranscript,
      recordingSessionId,
    } = input;

    return this.databaseService.withTransaction(async (client) => {
      const row = await this.lockInterviewForUpdate(client, id);
      const interview = this.mapRow(row);

      const currentQuestionIndex = this.getSubmittedAnswerCount(interview);
      if (questionIndex !== currentQuestionIndex) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Invalid question index — must answer in order',
          { interviewId: id, questionIndex, currentQuestionIndex },
        );
      }
      if (questionIndex >= interview.questions.length) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Question index is out of range',
          { interviewId: id, questionIndex },
        );
      }
      if (
        !matchesInterviewMediaKey({
          mediaKey,
          interviewId: id,
          questionIndex,
          mediaType: 'camera',
        })
      ) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Invalid camera recording key',
          { interviewId: id, questionIndex },
        );
      }
      if (
        screenMediaKey &&
        !matchesInterviewMediaKey({
          mediaKey: screenMediaKey,
          interviewId: id,
          questionIndex,
          mediaType: 'screen',
        })
      ) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Invalid screen recording key',
          { interviewId: id, questionIndex },
        );
      }

      const question = interview.questions[questionIndex];
      const existingAnswer =
        interview.answers.find((answer) => answer.questionIndex === questionIndex) ??
        undefined;
      if (existingAnswer?.status === 'submitted' && !submitAnswer) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Cannot update recording progress for a submitted answer',
          { interviewId: id, questionIndex },
        );
      }

      const normalizedVersionNumber =
        typeof versionNumber === 'number' && versionNumber > 0
          ? versionNumber
          : 1;
      const existingVersions = this.getAnswerVersions(existingAnswer);
      const existingVersion = existingVersions.find(
        (version) => version.versionNumber === normalizedVersionNumber,
      );
      const versionRefs = existingVersions.map((version) => ({
        versionNumber: version.versionNumber,
      }));
      const notReservedReason = getAnswerVersionNotReservedBlockReason(
        versionRefs,
        normalizedVersionNumber,
      );
      if (notReservedReason) {
        throw apiBadRequest(
          ApiErrorCode.ANSWER_VERSION_NOT_RESERVED,
          notReservedReason,
          {
            interviewId: id,
            questionIndex,
            versionNumber: normalizedVersionNumber,
          },
        );
      }

      const sessionLockReason = getRecordingSessionLockBlockReason(
        existingAnswer?.recordingSessionId,
        recordingSessionId,
      );
      if (sessionLockReason) {
        throw apiConflict(
          ApiErrorCode.RECORDING_SESSION_MISMATCH,
          sessionLockReason,
          {
            interviewId: id,
            questionIndex,
            versionNumber: normalizedVersionNumber,
          },
        );
      }

      const overwriteReason = getAnswerVersionOverwriteBlockReason(
        existingVersion?.mediaKey,
        mediaKey,
      );
      if (overwriteReason) {
        throw apiConflict(
          ApiErrorCode.ANSWER_VERSION_OVERWRITE_FORBIDDEN,
          overwriteReason,
          {
            interviewId: id,
            questionIndex,
            versionNumber: normalizedVersionNumber,
          },
        );
      }

      const attemptLimitReason = getAnswerAttemptLimitBlockReason(
        versionRefs,
        normalizedVersionNumber,
      );
      if (attemptLimitReason) {
        throw apiBadRequest(
          ApiErrorCode.ANSWER_ATTEMPT_LIMIT_REACHED,
          attemptLimitReason,
          { interviewId: id, questionIndex, versionNumber: normalizedVersionNumber },
        );
      }

      const uploadedAt = existingVersion?.uploadedAt ?? new Date();
      const normalizedStartedAt =
        startedAt && !Number.isNaN(startedAt.getTime())
          ? startedAt
          : existingVersion?.startedAt;
      let normalizedSubmittedAt = this.resolveSubmittedAt({
        submittedAt,
        uploadedAt,
        existingVersion,
        fallback: options.submittedAtFallback,
      });

      if (
        !submitAnswer &&
        normalizedStartedAt &&
        normalizedSubmittedAt &&
        normalizedSubmittedAt.getTime() < normalizedStartedAt.getTime()
      ) {
        normalizedSubmittedAt = undefined;
      }

      if (
        normalizedStartedAt &&
        normalizedSubmittedAt &&
        normalizedSubmittedAt.getTime() < normalizedStartedAt.getTime()
      ) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'submittedAt must be after startedAt for the answer',
          { interviewId: id, questionIndex },
        );
      }

      const normalizedBehaviorSignals = this.mergeBehaviorSignals(
        existingVersion?.behaviorSignals ??
          existingAnswer?.behaviorSignals,
        behaviorSignals,
      );
      const normalizedBehaviorEvents = this.buildBehaviorEventsSnapshot(
        existingVersion?.behaviorEvents ??
          existingAnswer?.behaviorEvents,
        behaviorEvents,
        normalizedVersionNumber,
        options.mergeBehaviorEvents,
      );
      const currentVersion: AnswerVersion = {
        versionNumber: normalizedVersionNumber,
        mediaKey,
        screenMediaKey,
        reservedAt: existingVersion?.reservedAt,
        uploadedAt,
        durationSeconds:
          typeof durationSeconds === 'number' && durationSeconds > 0
            ? durationSeconds
            : existingVersion?.durationSeconds,
        startedAt: normalizedStartedAt,
        submittedAt: normalizedSubmittedAt,
        camera: this.buildMediaArtifact({
          mediaKey,
          uploadedAt,
          fileSizeBytes:
            this.normalizePositiveNumber(cameraFileSizeBytes) ??
            existingVersion?.camera?.fileSizeBytes ??
            existingAnswer?.camera?.fileSizeBytes,
        }),
        screen: screenMediaKey
          ? this.buildMediaArtifact({
              mediaKey: screenMediaKey,
              uploadedAt,
              fileSizeBytes:
                this.normalizePositiveNumber(screenFileSizeBytes) ??
                existingVersion?.screen?.fileSizeBytes ??
                existingAnswer?.screen?.fileSizeBytes,
            })
          : undefined,
        behaviorSignals: normalizedBehaviorSignals,
        behaviorEvents: normalizedBehaviorEvents,
      };

      const nextVersions = [
        ...existingVersions.filter(
          (version) => version.versionNumber !== normalizedVersionNumber,
        ),
        currentVersion,
      ].sort((left, right) => left.versionNumber - right.versionNumber);

      const selectedVersionNumber = options.preserveLatestSelectedVersion
        ? Math.max(
            existingAnswer?.selectedVersionNumber ?? 0,
            normalizedVersionNumber,
          )
        : normalizedVersionNumber;
      const selectedVersion =
        nextVersions.find(
          (version) => version.versionNumber === selectedVersionNumber,
        ) ?? currentVersion;
      const shouldCarryTranscriptFromPreviousVersion =
        existingAnswer?.selectedVersionNumber === selectedVersionNumber;

      const nextAnswer: Answer = {
        questionIndex,
        questionId: question.id,
        status: submitAnswer ? 'submitted' : 'recording',
        mediaKey: selectedVersion.mediaKey,
        screenMediaKey: selectedVersion.screenMediaKey,
        uploadedAt: selectedVersion.uploadedAt ?? uploadedAt,
        durationSeconds: selectedVersion.durationSeconds,
        retakeCount: Math.max(nextVersions.length - 1, 0),
        startedAt: selectedVersion.startedAt,
        submittedAt: selectedVersion.submittedAt,
        camera: selectedVersion.camera,
        screen: selectedVersion.screen,
        behaviorSignals: selectedVersion.behaviorSignals,
        selectedVersionNumber,
        versions: nextVersions,
        behaviorEvents: selectedVersion.behaviorEvents,
        transcript: clientTranscript
          ? this.normalizeTranscript(clientTranscript)
          : shouldCarryTranscriptFromPreviousVersion
            ? existingAnswer?.transcript
            : undefined,
        evaluation: existingAnswer?.evaluation,
        validation: existingAnswer?.validation,
        recordingSessionId: existingAnswer?.recordingSessionId,
      };

      const nextAnswers = existingAnswer
        ? interview.answers.map((answer) =>
            answer.questionIndex === questionIndex ? nextAnswer : answer,
          )
        : [...interview.answers, nextAnswer].sort(
            (left, right) => left.questionIndex - right.questionIndex,
          );

      const now = new Date();
      return this.saveInterviewInTransaction(client, {
        ...interview,
        answers: nextAnswers,
        status: 'in_progress',
        workflow: this.buildWorkflow('idle', now, {
          startedAt: interview.workflow?.startedAt,
        }),
        updatedAt: now,
      });
    });
  }

  private requireAnswer(interview: Interview, questionIndex: number): Answer {
    const answer = interview.answers.find(
      (item) => item.questionIndex === questionIndex,
    );

    if (!answer) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        `Answer for question ${questionIndex} is not available`,
        { questionIndex },
      );
    }

    return answer;
  }

  private async lockInterviewForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<InterviewRow> {
    const result = await client.query<InterviewRow>(
      `
        SELECT ${INTERVIEW_SELECT_COLUMNS}
        ${INTERVIEW_SELECT_FROM}
        WHERE i.id = $1
        FOR UPDATE OF i
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw apiNotFound(
        ApiErrorCode.INTERVIEW_NOT_FOUND,
        `Interview with id "${id}" not found`,
        { id },
      );
    }

    return result.rows[0];
  }

  private interviewUpdateParams(interview: Interview): unknown[] {
    return [
      interview.id,
      interview.candidateName,
      interview.candidateEmail ?? null,
      interview.position,
      JSON.stringify(interview.questions),
      JSON.stringify(interview.answers),
      interview.status,
      interview.result ? JSON.stringify(interview.result) : null,
      interview.workflow ? JSON.stringify(interview.workflow) : null,
      interview.assignedHrId ?? null,
    ];
  }

  private async saveInterviewInTransaction(
    client: PoolClient,
    interview: Interview,
  ): Promise<Interview> {
    const result = await client.query<InterviewRow>(
      INTERVIEW_UPDATE_WITH_ASSIGNEE_SQL,
      this.interviewUpdateParams(interview),
    );

    return this.mapRow(result.rows[0]);
  }

  private async saveInterviewWithTerminalSideEffects(
    previousStatus: Interview['status'],
    interview: Interview,
    client?: PoolClient,
  ): Promise<Interview> {
    const becameTerminal =
      !isTerminalInterviewStatus(previousStatus) &&
      isTerminalInterviewStatus(interview.status);

    const persist = async (tx: PoolClient): Promise<Interview> => {
      if (becameTerminal) {
        await this.lockInterviewForUpdate(tx, interview.id);
        const saved = await this.saveInterviewInTransaction(tx, interview);
        await this.questionService.processPendingDeletionsAfterTerminalInterview(
          tx,
          interview.questions.map((question) => question.id),
        );
        return saved;
      }
      return this.saveInterviewInTransaction(tx, interview);
    };

    return client
      ? persist(client)
      : this.databaseService.withTransaction(persist);
  }

  private async saveInterview(interview: Interview): Promise<Interview> {
    const result = await this.databaseService.query<InterviewRow>(
      INTERVIEW_UPDATE_WITH_ASSIGNEE_SQL,
      this.interviewUpdateParams(interview),
    );

    return this.mapRow(result.rows[0]);
  }

  async recomputeResult(id: string): Promise<Interview> {
    const interview = await this.findOne(id);
    const next = this.applyResultRecomputation(interview);
    if (next === interview) {
      return interview;
    }
    return this.saveInterviewWithTerminalSideEffects(interview.status, next);
  }

  private applyResultRecomputation(interview: Interview): Interview {
    const submittedAnswers = interview.answers.filter(
      (answer) => answer.status === 'submitted',
    );
    const evaluatedAnswers = submittedAnswers.filter(
      (answer) => answer.evaluation && typeof answer.evaluation.overallScore === 'number',
    );

    if (evaluatedAnswers.length === 0) {
      return interview;
    }

    const questionsByIndex = new Map(
      interview.questions.map((question, index) => [index, question]),
    );

    let totalWeight = 0;
    let weightedScore = 0;
    const categorySums: Record<string, { weight: number; total: number }> = {};
    let maxRisk: InterviewBehaviorRisk = 'low';
    const questionResults: InterviewQuestionResult[] = [];

    for (const answer of evaluatedAnswers) {
      const evaluation = answer.evaluation;
      if (!evaluation || typeof evaluation.overallScore !== 'number') {
        continue;
      }

      const question = questionsByIndex.get(answer.questionIndex);
      const weight =
        typeof question?.weight === 'number' && question.weight > 0
          ? question.weight
          : 1;

      totalWeight += weight;
      weightedScore += evaluation.overallScore * weight;

      if (evaluation.categoryScores) {
        for (const [key, value] of Object.entries(evaluation.categoryScores)) {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            continue;
          }
          const bucket =
            categorySums[key] ?? { weight: 0, total: 0 };
          bucket.weight += weight;
          bucket.total += value * weight;
          categorySums[key] = bucket;
        }
      }

      if (
        evaluation.behaviorRisk &&
        compareBehaviorRisk(evaluation.behaviorRisk, maxRisk) > 0
      ) {
        maxRisk = evaluation.behaviorRisk;
      }

      questionResults.push({
        questionIndex: answer.questionIndex,
        questionId: answer.questionId,
        score: evaluation.overallScore,
        categoryScores: evaluation.categoryScores,
        summary: evaluation.summary,
        decisionHint: evaluation.decisionHint,
      });
    }

    const overallScore =
      totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    const categoryScores: Record<string, number> = {};
    for (const [key, { weight, total }] of Object.entries(categorySums)) {
      if (weight > 0) {
        categoryScores[key] = Math.round(total / weight);
      }
    }

    const decision = this.computeInterviewDecision(overallScore, maxRisk);
    const summary = buildInterviewSummary(
      questionResults,
      interview.interviewLocale,
    );
    const trustScore = this.riskToTrustScore(maxRisk);

    const allAnswered = submittedAnswers.length >= interview.questions.length;
    const terminalAnswers = submittedAnswers.filter(
      (answer) =>
        answer.validation?.status === 'completed' ||
        answer.validation?.status === 'failed',
    );
    const allTerminal = terminalAnswers.length === submittedAnswers.length;
    const isFinal = allAnswered && allTerminal;
    const completedAt = new Date();

    const result: InterviewResult = {
      interviewLocale: interview.interviewLocale,
      overallScore,
      summary,
      improvements: buildFeedbackImprovements(
        questionResults,
        interview.interviewLocale,
      ),
      categoryScores,
      rubricVersion: 'mvp-v1',
      decision,
      trustScore,
      trustFlags: [],
      behaviorSummary: {
        riskLevel: maxRisk,
        notes: [],
      },
      questionResults: questionResults.sort(
        (left, right) => left.questionIndex - right.questionIndex,
      ),
      completedAt,
    };

    return {
      ...interview,
      result,
      status: isFinal ? 'completed' : interview.status,
      workflow: isFinal
        ? this.buildWorkflow('completed', completedAt, {
            currentStage: 'store_result',
            startedAt: interview.workflow?.startedAt,
            completedAt,
          })
        : this.buildWorkflow('processing', completedAt, {
            currentStage: 'analyze_answers',
            startedAt: interview.workflow?.startedAt ?? completedAt,
          }),
      updatedAt: completedAt,
    };
  }

  private computeInterviewDecision(
    overallScore: number,
    riskLevel: InterviewBehaviorRisk,
  ): InterviewDecision {
    if (riskLevel === 'high' || overallScore < 50) {
      return 'reject';
    }
    if (riskLevel === 'medium' || overallScore < 70) {
      return 'review';
    }
    return 'proceed';
  }

  private riskToTrustScore(riskLevel: InterviewBehaviorRisk): number {
    if (riskLevel === 'high') {
      return 40;
    }
    if (riskLevel === 'medium') {
      return 70;
    }
    return 100;
  }

  private async assertAssignableHrUser(
    client: PoolClient,
    userId: string,
    interviewDemo: boolean,
  ): Promise<void> {
    const result = await client.query<{ id: string; role: string; demo: boolean }>(
      `
        SELECT id, role, demo
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    const user = result.rows[0];
    if (!user) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'Assigned HR user not found',
        { assignedHrId: userId },
      );
    }
    if (user.role !== 'hr') {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'Assigned user must have the HR role',
        { assignedHrId: userId, role: user.role },
      );
    }
    if (Boolean(user.demo) !== interviewDemo) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'Assigned HR user must belong to the same demo scope as the interview',
        { assignedHrId: userId },
      );
    }
  }

  private mapRow(row: InterviewRow): Interview {
    const questions = (row.questions_json ?? []).map((question) =>
      this.questionService.hydrateStoredQuestionCore(question),
    );

    const interviewLocale = isLocale(row.interview_locale)
      ? row.interview_locale
      : DEFAULT_LOCALE;

    return {
      id: row.id,
      candidateName: row.candidate_name,
      candidateEmail: row.candidate_email ?? undefined,
      position: row.position,
      assignedHrId: row.assigned_hr_id ?? undefined,
      assignedHr:
        row.assigned_hr_id &&
        row.assigned_hr_name &&
        row.assigned_hr_email
          ? {
              id: row.assigned_hr_id,
              name: row.assigned_hr_name,
              email: row.assigned_hr_email,
            }
          : undefined,
      interviewLocale,
      questions,
      answers: (row.answers_json ?? []).map((answer) =>
        this.normalizeAnswer(answer, questions),
      ),
      status: row.status,
      result: this.normalizeResult(row.result_json, interviewLocale),
      workflow: this.normalizeWorkflow(
        row.workflow_json,
        row.status,
        row.updated_at,
      ),
      createdById: row.created_by_id ?? undefined,
      demo: Boolean(row.demo),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private normalizeAnswer(
    rawAnswer: Record<string, unknown>,
    questions: InterviewQuestion[],
  ): Answer {
    const questionIndex = this.asNumber(rawAnswer.questionIndex) ?? 0;
    const uploadedAt = this.asDate(rawAnswer.uploadedAt) ?? new Date();
    const mediaKey =
      this.asString(rawAnswer.mediaKey) ??
      this.asString((rawAnswer.camera as Record<string, unknown> | undefined)?.mediaKey) ??
      '';
    const screenMediaKey =
      this.asString(rawAnswer.screenMediaKey) ??
      this.asString((rawAnswer.screen as Record<string, unknown> | undefined)?.mediaKey);
    const questionId =
      this.asString(rawAnswer.questionId) ??
      questions[questionIndex]?.id ??
      `question-${questionIndex}`;
    const versions = this.normalizeAnswerVersions(rawAnswer, mediaKey, screenMediaKey, uploadedAt);
    const latestVersion =
      versions.length > 0 ? versions[versions.length - 1] : undefined;
    const selectedVersionNumber =
      this.asNumber(rawAnswer.selectedVersionNumber) ??
      latestVersion?.versionNumber;
    const selectedVersion =
      versions.find((version) => version.versionNumber === selectedVersionNumber) ??
      latestVersion;

    return {
      questionIndex,
      questionId,
      status:
        (this.asString(rawAnswer.status) as Answer['status'] | undefined) ??
        'submitted',
      mediaKey: selectedVersion?.mediaKey ?? mediaKey,
      screenMediaKey: selectedVersion?.screenMediaKey ?? screenMediaKey,
      uploadedAt: selectedVersion?.uploadedAt ?? uploadedAt,
      durationSeconds:
        selectedVersion?.durationSeconds ??
        this.asNumber(rawAnswer.durationSeconds),
      retakeCount:
        this.asNumber(rawAnswer.retakeCount) ?? Math.max(versions.length - 1, 0),
      startedAt: selectedVersion?.startedAt ?? this.asDate(rawAnswer.startedAt),
      submittedAt:
        selectedVersion?.submittedAt ?? this.asDate(rawAnswer.submittedAt),
      camera:
        selectedVersion?.camera ??
        this.normalizeMediaArtifact(rawAnswer.camera, mediaKey, uploadedAt),
      screen:
        selectedVersion?.screen ??
        this.normalizeMediaArtifact(
          rawAnswer.screen,
          screenMediaKey,
          uploadedAt,
        ),
      behaviorSignals:
        selectedVersion?.behaviorSignals ??
        this.normalizeBehaviorSignals(rawAnswer.behaviorSignals),
      selectedVersionNumber,
      versions,
      behaviorEvents:
        selectedVersion?.behaviorEvents ??
        this.normalizeBehaviorEvents(
          rawAnswer.behaviorEvents,
          selectedVersionNumber ?? 1,
        ),
      transcript: this.normalizeTranscript(rawAnswer.transcript),
      evaluation: this.normalizeEvaluation(rawAnswer.evaluation),
      validation: this.normalizeAnswerValidation(rawAnswer.validation),
      recordingSessionId: this.asString(rawAnswer.recordingSessionId),
    };
  }

  private normalizeAnswerVersions(
    rawAnswer: Record<string, unknown>,
    fallbackMediaKey: string,
    fallbackScreenMediaKey: string | undefined,
    fallbackUploadedAt: Date,
  ): AnswerVersion[] {
    const rawVersions = Array.isArray(rawAnswer.versions)
      ? rawAnswer.versions
      : [];

    const normalizedVersions = rawVersions
      .map((version) => this.asRecord(version))
      .filter((version): version is Record<string, unknown> => Boolean(version))
      .map((version) => this.normalizeAnswerVersion(version, fallbackUploadedAt))
      .filter((version): version is AnswerVersion => Boolean(version));

    if (normalizedVersions.length > 0) {
      return normalizedVersions.sort(
        (left, right) => left.versionNumber - right.versionNumber,
      );
    }

    if (!fallbackMediaKey) {
      return [];
    }

    return [
      {
        versionNumber: 1,
        mediaKey: fallbackMediaKey,
        screenMediaKey: fallbackScreenMediaKey,
        uploadedAt: fallbackUploadedAt,
        durationSeconds: this.asNumber(rawAnswer.durationSeconds),
        startedAt: this.asDate(rawAnswer.startedAt),
        submittedAt: this.asDate(rawAnswer.submittedAt),
        camera: this.normalizeMediaArtifact(
          rawAnswer.camera,
          fallbackMediaKey,
          fallbackUploadedAt,
        ),
        screen: this.normalizeMediaArtifact(
          rawAnswer.screen,
          fallbackScreenMediaKey,
          fallbackUploadedAt,
        ),
        behaviorSignals: this.normalizeBehaviorSignals(rawAnswer.behaviorSignals),
        behaviorEvents: this.normalizeBehaviorEvents(
          rawAnswer.behaviorEvents,
          1,
        ),
      },
    ];
  }

  private normalizeAnswerVersion(
    rawVersion: Record<string, unknown>,
    fallbackUploadedAt: Date,
  ): AnswerVersion | undefined {
    const versionNumber = this.asNumber(rawVersion.versionNumber) ?? 1;
    const mediaKey = this.asString(rawVersion.mediaKey);
    const reservedAt = this.asDate(rawVersion.reservedAt);
    if (!mediaKey && !reservedAt) {
      return undefined;
    }

    const uploadedAt =
      this.asDate(rawVersion.uploadedAt) ??
      reservedAt ??
      new Date(fallbackUploadedAt);

    return {
      versionNumber,
      mediaKey: mediaKey ?? '',
      screenMediaKey: this.asString(rawVersion.screenMediaKey),
      reservedAt,
      uploadedAt,
      durationSeconds: this.asNumber(rawVersion.durationSeconds),
      startedAt: this.asDate(rawVersion.startedAt),
      submittedAt: this.asDate(rawVersion.submittedAt),
      camera: mediaKey
        ? this.normalizeMediaArtifact(
            rawVersion.camera,
            mediaKey,
            uploadedAt,
          )
        : undefined,
      screen: mediaKey
        ? this.normalizeMediaArtifact(
            rawVersion.screen,
            this.asString(rawVersion.screenMediaKey),
            uploadedAt,
          )
        : undefined,
      behaviorSignals: this.normalizeBehaviorSignals(rawVersion.behaviorSignals),
      behaviorEvents: this.normalizeBehaviorEvents(
        rawVersion.behaviorEvents,
        versionNumber,
      ),
    };
  }

  private normalizeMediaArtifact(
    value: unknown,
    fallbackMediaKey: string | undefined,
    fallbackUploadedAt: Date,
  ): MediaArtifact | undefined {
    const rawArtifact = this.asRecord(value);
    const mediaKey =
      this.asString(rawArtifact?.mediaKey) ??
      (fallbackMediaKey?.trim() ? fallbackMediaKey.trim() : undefined);

    if (!mediaKey) {
      return undefined;
    }

    return {
      mediaKey,
      contentType: this.asString(rawArtifact?.contentType) ?? 'video/webm',
      fileSizeBytes: this.asNumber(rawArtifact?.fileSizeBytes),
      uploadedAt:
        this.asDate(rawArtifact?.uploadedAt) ?? new Date(fallbackUploadedAt),
    };
  }

  private normalizeBehaviorSignals(value: unknown): AnswerBehaviorSignals {
    const rawSignals = this.asRecord(value);

    return {
      tabHiddenCount: this.asNumber(rawSignals?.tabHiddenCount) ?? 0,
      windowBlurCount: this.asNumber(rawSignals?.windowBlurCount) ?? 0,
      pasteCount: this.asNumber(rawSignals?.pasteCount) ?? 0,
      keydownCount: this.asNumber(rawSignals?.keydownCount) ?? 0,
      copyCount: this.asNumber(rawSignals?.copyCount) ?? 0,
      resizeCount: this.asNumber(rawSignals?.resizeCount) ?? 0,
    };
  }

  private normalizeBehaviorEvents(
    value: unknown,
    fallbackVersionNumber: number,
  ): AnswerBehaviorEvent[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((event) => this.asRecord(event))
      .filter((event): event is Record<string, unknown> => Boolean(event))
      .map((event) => {
        const eventType = this.asString(event.eventType) as
          | AnswerBehaviorEvent['eventType']
          | undefined;
        const occurredAt = this.asDate(event.occurredAt);

        if (!eventType || !occurredAt) {
          return undefined;
        }

        return {
          eventType,
          occurredAt,
          versionNumber:
            this.asNumber(event.versionNumber) ?? fallbackVersionNumber,
        };
      })
      .filter((event): event is AnswerBehaviorEvent => Boolean(event));
  }

  private mergeBehaviorSignals(
    existingSignals: AnswerBehaviorSignals | undefined,
    nextSignals: AnswerBehaviorSignals | undefined,
  ): AnswerBehaviorSignals {
    if (!nextSignals) {
      return existingSignals
        ? this.normalizeBehaviorSignals(existingSignals)
        : this.normalizeBehaviorSignals(undefined);
    }

    return this.normalizeBehaviorSignals(nextSignals);
  }

  private buildBehaviorEventsSnapshot(
    existingEvents: AnswerBehaviorEvent[] | undefined,
    nextEvents: AnswerBehaviorEvent[] | undefined,
    fallbackVersionNumber: number,
    mergeEvents: boolean,
  ): AnswerBehaviorEvent[] {
    const normalizedNextEvents = this.normalizeBehaviorEvents(
      nextEvents,
      fallbackVersionNumber,
    );

    if (!mergeEvents) {
      return normalizedNextEvents;
    }

    return this.mergeBehaviorEvents(existingEvents ?? [], normalizedNextEvents);
  }

  private mergeBehaviorEvents(
    existingEvents: AnswerBehaviorEvent[],
    nextEvents: AnswerBehaviorEvent[],
  ): AnswerBehaviorEvent[] {
    const byKey = new Map<string, AnswerBehaviorEvent>();

    [...existingEvents, ...nextEvents].forEach((event) => {
      const key = `${event.versionNumber}:${event.eventType}:${event.occurredAt.toISOString()}`;
      byKey.set(key, event);
    });

    return [...byKey.values()].sort(
      (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
    );
  }

  private resolveSubmittedAt({
    submittedAt,
    uploadedAt,
    existingVersion,
    fallback,
  }: {
    submittedAt?: Date;
    uploadedAt: Date;
    existingVersion?: AnswerVersion;
    fallback: 'now' | 'keep';
  }): Date | undefined {
    if (submittedAt && !Number.isNaN(submittedAt.getTime())) {
      return submittedAt;
    }

    if (existingVersion?.submittedAt) {
      return existingVersion.submittedAt;
    }

    return fallback === 'now' ? uploadedAt : undefined;
  }

  private mergeTranscript(
    existingTranscript: AnswerTranscript | undefined,
    incomingTranscript: AnswerTranscript | undefined,
  ): AnswerTranscript | undefined {
    if (!incomingTranscript) {
      return existingTranscript;
    }

    return this.normalizeTranscript({
      ...(existingTranscript ?? {}),
      ...incomingTranscript,
    });
  }

  private normalizeTranscript(value: unknown): AnswerTranscript | undefined {
    const rawTranscript = this.asRecord(value);
    if (!rawTranscript) {
      return undefined;
    }

    const text = this.asString(rawTranscript.text);
    const language = this.asString(rawTranscript.language);
    const provider = this.asString(rawTranscript.provider);
    const generatedAt = this.asDate(rawTranscript.generatedAt);
    const isFinal =
      typeof rawTranscript.isFinal === 'boolean'
        ? rawTranscript.isFinal
        : undefined;

    if (!text && !language && !provider && !generatedAt && isFinal === undefined) {
      return undefined;
    }

    return {
      text,
      language,
      provider,
      generatedAt,
      isFinal,
    };
  }

  private normalizeEvaluation(value: unknown): AnswerEvaluation | undefined {
    const rawEvaluation = this.asRecord(value);
    if (!rawEvaluation) {
      return undefined;
    }

    const overallScore = this.asNumber(rawEvaluation.overallScore);
    const categoryScores = this.asNumberRecord(rawEvaluation.categoryScores);
    const coveredConceptIds = this.asStringArray(rawEvaluation.coveredConceptIds);
    const missedConceptIds = this.asStringArray(rawEvaluation.missedConceptIds);
    const redFlagIds = this.asStringArray(rawEvaluation.redFlagIds);
    const behaviorRisk = this.asString(rawEvaluation.behaviorRisk) as
      | AnswerEvaluation['behaviorRisk']
      | undefined;
    const summary = this.asString(rawEvaluation.summary);
    const decisionHint = this.asString(rawEvaluation.decisionHint) as
      | AnswerEvaluation['decisionHint']
      | undefined;
    const evaluatedAt = this.asDate(rawEvaluation.evaluatedAt);

    if (
      overallScore === undefined &&
      Object.keys(categoryScores).length === 0 &&
      coveredConceptIds.length === 0 &&
      missedConceptIds.length === 0 &&
      redFlagIds.length === 0 &&
      !behaviorRisk &&
      !summary &&
      !decisionHint &&
      !evaluatedAt
    ) {
      return undefined;
    }

    return {
      overallScore,
      categoryScores,
      coveredConceptIds,
      missedConceptIds,
      redFlagIds,
      behaviorRisk,
      summary,
      decisionHint,
      evaluatedAt,
    };
  }

  private normalizeAnswerValidation(
    value: unknown,
  ): AnswerValidation | undefined {
    const rawValidation = this.asRecord(value);
    if (!rawValidation) {
      return undefined;
    }

    const status = this.asString(rawValidation.status) as
      | AnswerValidation['status']
      | undefined;
    const executionArn = this.asString(rawValidation.executionArn);
    const sourceVersionNumber = this.asNumber(
      rawValidation.sourceVersionNumber,
    );
    const runId = this.asString(rawValidation.runId);
    const requestedAt = this.asDate(rawValidation.requestedAt);
    const startedAt = this.asDate(rawValidation.startedAt);
    const completedAt = this.asDate(rawValidation.completedAt);
    const errorMessage = this.asString(rawValidation.errorMessage);

    if (
      !status &&
      !executionArn &&
      sourceVersionNumber === undefined &&
      !runId &&
      !requestedAt &&
      !startedAt &&
      !completedAt &&
      !errorMessage
    ) {
      return undefined;
    }

    return {
      status: status ?? 'idle',
      executionArn,
      sourceVersionNumber,
      runId,
      requestedAt,
      startedAt,
      completedAt,
      errorMessage,
    };
  }

  private normalizeResult(
    value: Record<string, unknown> | null,
    interviewLocale: Locale,
  ): InterviewResult | undefined {
    const rawResult = this.asRecord(value);
    if (!rawResult) {
      return undefined;
    }

    const storedInterviewLocale = this.asString(rawResult.interviewLocale);
    return {
      interviewLocale:
        storedInterviewLocale && isLocale(storedInterviewLocale)
          ? storedInterviewLocale
          : interviewLocale,
      overallScore: this.asNumber(rawResult.overallScore) ?? 0,
      summary: this.asString(rawResult.summary) ?? '',
      improvements: this.asString(rawResult.improvements),
      categoryScores: this.asNumberRecord(rawResult.categoryScores),
      rubricVersion: this.asString(rawResult.rubricVersion),
      decision: this.asString(rawResult.decision) as
        | InterviewResult['decision']
        | undefined,
      trustScore: this.asNumber(rawResult.trustScore),
      trustFlags: this.asStringArray(rawResult.trustFlags),
      behaviorSummary: this.normalizeBehaviorSummary(rawResult.behaviorSummary),
      questionResults: this.normalizeQuestionResults(rawResult.questionResults),
      completedAt: this.asDate(rawResult.completedAt) ?? new Date(),
    };
  }

  private normalizeBehaviorSummary(
    value: unknown,
  ): InterviewResult['behaviorSummary'] {
    const rawSummary = this.asRecord(value);
    if (!rawSummary) {
      return undefined;
    }

    return {
      riskLevel: this.asString(rawSummary.riskLevel) as
        | 'low'
        | 'medium'
        | 'high'
        | undefined,
      notes: this.asStringArray(rawSummary.notes),
    };
  }

  private normalizeQuestionResults(value: unknown): InterviewQuestionResult[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        questionIndex: this.asNumber(item.questionIndex) ?? 0,
        questionId: this.asString(item.questionId) ?? '',
        score: this.asNumber(item.score),
        categoryScores: this.asNumberRecord(item.categoryScores),
        summary: this.asString(item.summary),
        decisionHint: this.asString(item.decisionHint) as
          | InterviewQuestionResult['decisionHint']
          | undefined,
      }));
  }

  private normalizeWorkflow(
    value: Record<string, unknown> | null,
    interviewStatus: Interview['status'],
    updatedAt: Date,
  ): InterviewWorkflow {
    const rawWorkflow = this.asRecord(value);
    if (!rawWorkflow) {
      return this.buildWorkflow(
        this.deriveWorkflowStatus(interviewStatus),
        new Date(updatedAt),
      );
    }

    return {
      status:
        (this.asString(rawWorkflow.status) as InterviewWorkflow['status']) ??
        this.deriveWorkflowStatus(interviewStatus),
      currentStage: this.asString(rawWorkflow.currentStage) as
        | InterviewWorkflow['currentStage']
        | undefined,
      executionId: this.asString(rawWorkflow.executionId),
      startedAt: this.asDate(rawWorkflow.startedAt),
      completedAt: this.asDate(rawWorkflow.completedAt),
      lastUpdatedAt:
        this.asDate(rawWorkflow.lastUpdatedAt) ?? new Date(updatedAt),
      errorMessage: this.asString(rawWorkflow.errorMessage),
    };
  }

  private buildWorkflow(
    status: InterviewWorkflow['status'],
    timestamp: Date,
    overrides: Partial<InterviewWorkflow> = {},
  ): InterviewWorkflow {
    return {
      status,
      lastUpdatedAt: timestamp,
      ...overrides,
    };
  }

  private buildMediaArtifact({
    mediaKey,
    uploadedAt,
    fileSizeBytes,
  }: {
    mediaKey: string;
    uploadedAt: Date;
    fileSizeBytes?: number;
  }): MediaArtifact {
    return {
      mediaKey,
      contentType: 'video/webm',
      fileSizeBytes,
      uploadedAt,
    };
  }

  private deriveWorkflowStatus(
    interviewStatus: Interview['status'],
  ): InterviewWorkflow['status'] {
    switch (interviewStatus) {
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  }

  private getSubmittedAnswerCount(interview: Interview): number {
    return countSubmittedAnswers(interview);
  }

  private getAnswerVersions(answer?: Answer): AnswerVersion[] {
    if (!answer) {
      return [];
    }

    if (answer.versions?.length) {
      return [...answer.versions];
    }

    // Align with getSavedAnswerVersions: only invent a legacy slot when media exists.
    if (!answer.mediaKey?.trim()) {
      return [];
    }

    return [
      {
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
      },
    ];
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private normalizePositiveNumber(value: unknown): number | undefined {
    const numericValue = this.asNumber(value);
    return numericValue !== undefined && numericValue > 0
      ? numericValue
      : undefined;
  }

  private asDate(value: unknown): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private asNumberRecord(value: unknown): Record<string, number> {
    const rawRecord = this.asRecord(value);
    if (!rawRecord) {
      return {};
    }

    return Object.entries(rawRecord).reduce<Record<string, number>>(
      (accumulator, [key, itemValue]) => {
        if (typeof itemValue === 'number' && Number.isFinite(itemValue)) {
          accumulator[key] = itemValue;
        }
        return accumulator;
      },
      {},
    );
  }
}
