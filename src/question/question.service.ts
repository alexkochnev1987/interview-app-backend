import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest, apiConflict, apiNotFound } from '../common/errors/api-error';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { EmbeddingsService } from '../ai/embeddings/embeddings.service';
import { demoScopeClause } from '../common/demo-scope';
import { DatabaseService } from '../database/database.service';
import { ACTIVE_INTERVIEW_STATUSES } from '../interview/interfaces/interview.interface';
import { isLocale, Locale, SUPPORTED_LOCALES } from '../locale/locale.constants';
import { CreateQuestionDto } from './dto/create-question.dto';
import {
  asQuestionTranslationsMapInput,
  QuestionTranslationsMapInput,
} from './dto/question-translations-map.dto';
import {
  QueryQuestionsDto,
  QuestionSortField,
  QuestionSortOrder,
  QuestionStatusFilter,
} from './dto/query-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { applyTranslationsUpdate } from './question-translations-update';
import { findUnknownTranslationLocaleKeys } from './question-translation.validation';
import {
  Question,
  QuestionCore,
  QuestionDeleteBlockingInterview,
  QuestionDeleteScheduledItem,
  QuestionDifficulty,
  QuestionDraft,
  QuestionExpectedConcept,
  QuestionRedFlag,
  QuestionRedFlagSeverity,
  QuestionTranslation,
  QuestionTranslations,
  SimilarQuestionMatch,
  SoftDeleteQuestionResult,
} from './interfaces/question.interface';
import {
  buildTranslation,
  mapOutputLanguageToPrimaryLocale,
  mergeTranslations,
  parseTranslationsJson,
  primaryLocaleToOutputLanguage,
  QuestionLegacyFields,
  rejectPrimaryLocaleChange,
  resolvePrimaryLocale,
  resolveQuestionFields,
  ensurePrimaryTranslationBlock,
} from './question-locale';
import { resolveQuestion } from './resolve-question';
import { localeUiText } from '../locale/locale-ui-text';
import {
  buildQuestionSearchText,
  collectQuestionTextVariants,
} from './question-search-text';
import { toResolveQuestionInput } from './to-resolve-question-input';
import {
  buildScheduledDeleteReason,
  collectPendingDeletionAttachRejectIds,
  mapBlockingInterviews,
} from './question-scheduled-deletion.helpers';

export type ResolvedQuestion = Omit<Question, 'translations'> & {
  resolvedLocale: Locale;
  availableLocales: Locale[];
  fallbackFromLocale?: Locale;
  translations?: QuestionTranslations;
};

export const DEFAULT_QUESTIONS_PAGE = 1;
export const DEFAULT_QUESTIONS_LIMIT = 20;
export const MAX_QUESTIONS_LIMIT = 100;
export const DEFAULT_QUESTIONS_SORT_BY: QuestionSortField = 'updatedAt';
export const DEFAULT_QUESTIONS_SORT_ORDER: QuestionSortOrder = 'desc';

const SORT_FIELD_TO_SQL: Record<QuestionSortField, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  difficulty: "CASE difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END",
  questionText: 'lower(question_text)',
  popularity: 'usage_count',
};

export interface PaginatedQuestions {
  items: ResolvedQuestion[];
  total: number;
  page: number;
  limit: number;
}

export type FacetField =
  | 'difficulty'
  | 'category'
  | 'subcategory'
  | 'role'
  | 'primaryLocale'
  | 'outputLanguage'
  | 'locale'
  | 'tags';

export interface FacetCount {
  value: string;
  count: number;
}

export interface QuestionFacets {
  difficulties: FacetCount[];
  categories: FacetCount[];
  subcategories: FacetCount[];
  roles: FacetCount[];
  tags: FacetCount[];
}

interface QuestionRow {
  id: string;
  external_id: string | null;
  role: string | null;
  focus: string | null;
  output_language: string | null;
  primary_locale: string | null;
  translations_json: unknown;
  category: string | null;
  subcategory: string | null;
  text: string;
  question_text: string | null;
  follow_up_questions: string[] | null;
  expected_concepts: string[] | null;
  expected_concepts_json: unknown[] | null;
  red_flags: string[] | null;
  red_flags_json: unknown[] | null;
  difficulty: QuestionDifficulty;
  weight: number;
  sample_good_answer: string | null;
  minimum_pass_score: number | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  deleted: boolean;
  usage_count: number;
  pending_deletion: boolean;
}

const SIMILARITY_SCORE_THRESHOLD = 0.6;
const SIMILARITY_DISTANCE_THRESHOLD = 1 - SIMILARITY_SCORE_THRESHOLD;

const QUESTION_COLUMNS = `
  id,
  external_id,
  role,
  focus,
  output_language,
  primary_locale,
  translations_json,
  category,
  subcategory,
  text,
  question_text,
  follow_up_questions,
  expected_concepts,
  expected_concepts_json,
  red_flags,
  red_flags_json,
  difficulty,
  weight,
  sample_good_answer,
  minimum_pass_score,
  tags,
  metadata,
  created_at,
  updated_at,
  deleted,
  usage_count,
  pending_deletion
`;

const QUESTION_SELECT = `SELECT ${QUESTION_COLUMNS} FROM questions`;
const QUESTION_RETURNING = `RETURNING ${QUESTION_COLUMNS}`;
const QUESTION_Q_COLUMNS = QUESTION_COLUMNS.trim()
  .split(',')
  .map((column) => `q.${column.trim()}`)
  .join(',\n          ');

type QueryExecutor = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  private embeddingSourceText(
    question: Pick<
      Question,
      | 'primaryLocale'
      | 'translations'
      | 'questionText'
      | 'followUpQuestions'
      | 'expectedConcepts'
      | 'redFlags'
      | 'sampleGoodAnswer'
    >,
  ): string {
    return resolveQuestion(
      toResolveQuestionInput(question as QuestionCore),
      question.primaryLocale,
    ).questionText;
  }

  private async storeEmbedding(
    questionId: string,
    text: string,
  ): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    try {
      await this.embeddingsService.generateAndStore(questionId, trimmed);
    } catch (err) {
      this.logger.warn(
        `failed to store embedding for question ${questionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async create(dto: CreateQuestionDto): Promise<Question> {
    const payload = this.normalizeCreateQuestionInput(dto);
    const question = await this.insertQuestionRow(
      this.databaseService,
      payload,
    );
    await this.storeEmbedding(question.id, this.embeddingSourceText(question));
    return question;
  }

  async createResolved(dto: CreateQuestionDto): Promise<ResolvedQuestion> {
    const question = await this.create(dto);
    return this.toResolvedQuestion(question, question.primaryLocale, {
      includeTranslations: true,
    });
  }

  toResolvedQuestion(
    question: Question,
    locale: Locale,
    options: { includeTranslations?: boolean } = {},
  ): ResolvedQuestion {
    const resolved = resolveQuestion(question, locale);
    const { translations, ...stored } = question;
    const result: ResolvedQuestion = {
      ...stored,
      questionText: resolved.questionText,
      followUpQuestions: resolved.followUpQuestions,
      expectedConcepts: resolved.expectedConcepts,
      redFlags: resolved.redFlags,
      sampleGoodAnswer: resolved.sampleGoodAnswer,
      resolvedLocale: resolved.resolvedLocale,
      availableLocales: resolved.availableLocales,
    };
    if (resolved.fallbackFromLocale) {
      result.fallbackFromLocale = resolved.fallbackFromLocale;
    }
    if (options.includeTranslations) {
      result.translations = translations;
    }
    return result;
  }

  async upsertImportedQuestion(dto: CreateQuestionDto): Promise<Question> {
    const normalized = this.normalizeCreateQuestionInput(dto);

    const question = await this.databaseService.withTransaction(
      async (client) => {
        const existing = await this.findExistingForUpsert(client, normalized);

        if (!existing) {
          return this.insertQuestionRow(client, normalized);
        }

        if (existing.deleted) {
          await this.runWithDuplicateGuard(normalized, () =>
            client.query(
              `UPDATE questions SET deleted = FALSE WHERE id = $1`,
              [existing.id],
            ),
          );
        }

        return this.updateQuestionRow(client, existing.id, normalized);
      },
    );

    await this.storeEmbedding(question.id, this.embeddingSourceText(question));
    return question;
  }

  private async insertQuestionRow(
    executor: QueryExecutor,
    payload: QuestionDraft,
  ): Promise<Question> {
    await this.assertNoCrossLocaleTextDuplicate(
      executor,
      payload.questionText,
      payload.translations,
    );
    const result = await this.runWithDuplicateGuard(payload, () =>
      executor.query<QuestionRow>(
        `
          INSERT INTO questions (
            id,
            external_id,
            role,
            focus,
            output_language,
            primary_locale,
            translations_json,
            category,
            subcategory,
            text,
            question_text,
            follow_up_questions,
            expected_concepts,
            expected_concepts_json,
            red_flags,
            red_flags_json,
            difficulty,
            weight,
            sample_good_answer,
            minimum_pass_score,
            tags,
            metadata,
            search_text
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12, $13, $14::jsonb, $15, $16::jsonb, $17, $18, $19, $20, $21, $22::jsonb, $23
          )
          ${QUESTION_RETURNING}
        `,
        [
          crypto.randomUUID(),
          payload.externalId ?? null,
          payload.role ?? null,
          payload.focus ?? null,
          payload.outputLanguage,
          payload.primaryLocale,
          JSON.stringify(payload.translations),
          payload.category ?? null,
          payload.subcategory ?? null,
          payload.questionText,
          payload.questionText,
          payload.followUpQuestions,
          payload.expectedConcepts.map((item) => item.label),
          JSON.stringify(payload.expectedConcepts),
          payload.redFlags.map((item) => item.label),
          JSON.stringify(payload.redFlags),
          payload.difficulty,
          payload.weight,
          payload.sampleGoodAnswer ?? null,
          payload.minimumPassScore,
          payload.tags,
          JSON.stringify(payload.metadata),
          buildQuestionSearchText(payload.questionText, payload.translations),
        ],
      ),
    );

    return this.mapRow(result.rows[0]);
  }

  private async updateQuestionRow(
    executor: QueryExecutor,
    id: string,
    payload: QuestionDraft,
  ): Promise<Question> {
    await this.assertNoCrossLocaleTextDuplicate(
      executor,
      payload.questionText,
      payload.translations,
      id,
    );
    const result = await this.runWithDuplicateGuard(payload, () =>
      executor.query<QuestionRow>(
        `
          UPDATE questions
          SET
            external_id = $2,
            role = $3,
            focus = $4,
            output_language = $5,
            primary_locale = $6,
            translations_json = $7::jsonb,
            category = $8,
            subcategory = $9,
            text = $10,
            question_text = $11,
            follow_up_questions = $12,
            expected_concepts = $13,
            expected_concepts_json = $14::jsonb,
            red_flags = $15,
            red_flags_json = $16::jsonb,
            difficulty = $17,
            weight = $18,
            sample_good_answer = $19,
            minimum_pass_score = $20,
            tags = $21,
            metadata = $22::jsonb,
            search_text = $23,
            updated_at = NOW()
          WHERE id = $1
          ${QUESTION_RETURNING}
        `,
        [
          id,
          payload.externalId ?? null,
          payload.role ?? null,
          payload.focus ?? null,
          payload.outputLanguage,
          payload.primaryLocale,
          JSON.stringify(payload.translations),
          payload.category ?? null,
          payload.subcategory ?? null,
          payload.questionText,
          payload.questionText,
          payload.followUpQuestions,
          payload.expectedConcepts.map((item) => item.label),
          JSON.stringify(payload.expectedConcepts),
          payload.redFlags.map((item) => item.label),
          JSON.stringify(payload.redFlags),
          payload.difficulty,
          payload.weight,
          payload.sampleGoodAnswer ?? null,
          payload.minimumPassScore,
          payload.tags,
          JSON.stringify(payload.metadata),
          buildQuestionSearchText(payload.questionText, payload.translations),
        ],
      ),
    );

    return this.mapRow(result.rows[0]);
  }

  private async findExistingForUpsert(
    client: PoolClient,
    payload: QuestionDraft,
  ): Promise<Question | undefined> {
    if (payload.externalId) {
      const byExternal = await client.query<QuestionRow>(
        `
          ${QUESTION_SELECT}
          WHERE external_id = $1
          ORDER BY deleted ASC
          LIMIT 1
          FOR UPDATE
        `,
        [payload.externalId],
      );
      if (byExternal.rows[0]) {
        return this.mapRow(byExternal.rows[0]);
      }
    }

    const byText = await client.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE lower(question_text) = lower($1)
        ORDER BY deleted ASC
        LIMIT 1
        FOR UPDATE
      `,
      [payload.questionText],
    );

    return byText.rows[0] ? this.mapRow(byText.rows[0]) : undefined;
  }

  async findAll(
    query: QueryQuestionsDto = {},
    options: { forceActive?: boolean; resolveLocale: Locale; demo?: boolean },
  ): Promise<PaginatedQuestions> {
    const page = Math.max(1, query.page ?? DEFAULT_QUESTIONS_PAGE);
    const limit = Math.min(
      MAX_QUESTIONS_LIMIT,
      Math.max(1, query.limit ?? DEFAULT_QUESTIONS_LIMIT),
    );
    const offset = (page - 1) * limit;

    const sortBy = query.sortBy ?? DEFAULT_QUESTIONS_SORT_BY;
    const sortOrder = (query.sortOrder ?? DEFAULT_QUESTIONS_SORT_ORDER) === 'asc' ? 'ASC' : 'DESC';
    const sortExpression = SORT_FIELD_TO_SQL[sortBy];

    const status: QuestionStatusFilter = options.forceActive
      ? 'active'
      : (query.status ?? 'active');
    if (status === 'scheduled') {
      await this.flushEligiblePendingDeletions();
    }

    const { whereSql, params } = this.buildQuestionFilterClauses(query, {
      forceActive: options.forceActive,
      demo: options.demo,
    });

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const sql = `
      SELECT ${QUESTION_COLUMNS}, COUNT(*) OVER() AS __total
      FROM questions
      ${whereSql}
      ORDER BY ${sortExpression} ${sortOrder}, id ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.databaseService.query<QuestionRow & { __total: string }>(sql, params);
    const total = result.rows.length > 0 ? Number(result.rows[0].__total) : 0;
    const itemResolveLocale = query.locale ?? options.resolveLocale;
    const items = result.rows.map((row) =>
      this.toResolvedQuestion(this.mapRow(row), itemResolveLocale, {
        includeTranslations: query.includeTranslations === true,
      }),
    );

    return { items, total, page, limit };
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  private buildHasTranslationClause(localeParamRef: string): string {
    return `(
      COALESCE(trim(translations_json -> ${localeParamRef} ->> 'questionText'), '') <> ''
      OR (
        primary_locale = ${localeParamRef}
        AND COALESCE(
          trim(translations_json -> primary_locale ->> 'questionText'),
          trim(question_text),
          ''
        ) <> ''
      )
    )`;
  }

  private buildQuestionFilterClauses(
    query: QueryQuestionsDto,
    options: { forceActive?: boolean; excludeField?: FacetField; demo?: boolean } = {},
  ): { whereSql: string; params: unknown[] } {
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    // Demo isolation: demo users see only demo rows, everyone else only real rows.
    whereClauses.push(demoScopeClause(params, options.demo === true));

    const status: QuestionStatusFilter = options.forceActive
      ? 'active'
      : (query.status ?? 'active');
    if (status === 'active') {
      whereClauses.push('deleted = FALSE AND pending_deletion = FALSE');
    }else if (status === 'scheduled') {
      whereClauses.push('deleted = FALSE AND pending_deletion = TRUE');
    } else if (status === 'inactive') {
      whereClauses.push('deleted = TRUE');
    }

    if (query.q) {
      params.push(`%${this.escapeLike(query.q)}%`);
      const i = params.length;
      // search_text is maintained on write; OR branches below are not index-backed (see migration 0020).
      whereClauses.push(`(
        search_text ILIKE $${i}
        OR role ILIKE $${i}
        OR category ILIKE $${i}
        OR subcategory ILIKE $${i}
        OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ILIKE $${i})
      )`);
    }

    if (query.difficulty && options.excludeField !== 'difficulty') {
      params.push(query.difficulty);
      whereClauses.push(`difficulty = $${params.length}`);
    }

    if (query.category && options.excludeField !== 'category') {
      params.push(query.category.toLowerCase());
      whereClauses.push(`lower(category) = $${params.length}`);
    }

    if (query.subcategory && options.excludeField !== 'subcategory') {
      params.push(query.subcategory.toLowerCase());
      whereClauses.push(`lower(subcategory) = $${params.length}`);
    }

    if (query.role && options.excludeField !== 'role') {
      params.push(query.role.toLowerCase());
      whereClauses.push(`lower(role) = $${params.length}`);
    }

    if (
      query.primaryLocale &&
      options.excludeField !== 'primaryLocale' &&
      options.excludeField !== 'outputLanguage'
    ) {
      params.push(query.primaryLocale);
      whereClauses.push(`primary_locale = $${params.length}`);
    } else if (query.outputLanguage && options.excludeField !== 'outputLanguage') {
      const locale = mapOutputLanguageToPrimaryLocale(query.outputLanguage);
      params.push(locale);
      params.push(query.outputLanguage.toLowerCase());
      whereClauses.push(
        `(primary_locale = $${params.length - 1} OR lower(output_language) = $${params.length})`,
      );
    }

    if (query.locale && options.excludeField !== 'locale') {
      params.push(query.locale);
      const localeParam = `$${params.length}`;
      whereClauses.push(this.buildHasTranslationClause(localeParam));
    }

    if (
      query.tags &&
      query.tags.length > 0 &&
      options.excludeField !== 'tags'
    ) {
      params.push(query.tags.map((tag) => tag.toLowerCase()));
      whereClauses.push(`tags_lowercase(tags) && $${params.length}::text[]`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    return { whereSql, params };
  }

  async getFacets(
    query: QueryQuestionsDto = {},
    options: { forceActive?: boolean; demo?: boolean } = {},
  ): Promise<QuestionFacets> {
    const [difficulties, categories, subcategories, roles, tags] = await Promise.all([
      this.queryScalarFacet('difficulty', 'difficulty', query, options),
      this.queryScalarFacet('category', 'category', query, options),
      this.queryScalarFacet('subcategory', 'subcategory', query, options),
      this.queryScalarFacet('role', 'role', query, options),
      this.queryTagFacet(query, options),
    ]);

    return { difficulties, categories, subcategories, roles, tags };
  }

  private async queryScalarFacet(
    column: 'difficulty' | 'category' | 'subcategory' | 'role',
    facetField: FacetField,
    query: QueryQuestionsDto,
    options: { forceActive?: boolean; demo?: boolean },
  ): Promise<FacetCount[]> {
    const { whereSql, params } = this.buildQuestionFilterClauses(query, {
      forceActive: options.forceActive,
      excludeField: facetField,
      demo: options.demo,
    });

    const result = await this.databaseService.query<{
      value: string;
      count: string;
    }>(
      `
        SELECT ${column} AS value, COUNT(*)::text AS count
        FROM questions
        ${whereSql}
        ${whereSql ? 'AND' : 'WHERE'} ${column} IS NOT NULL AND ${column} <> ''
        GROUP BY ${column}
        ORDER BY COUNT(*) DESC, ${column} ASC
      `,
      params,
    );

    return result.rows.map((row) => ({
      value: row.value,
      count: Number(row.count),
    }));
  }

  private async queryTagFacet(
    query: QueryQuestionsDto,
    options: { forceActive?: boolean; demo?: boolean },
  ): Promise<FacetCount[]> {
    const { whereSql, params } = this.buildQuestionFilterClauses(query, {
      forceActive: options.forceActive,
      excludeField: 'tags',
      demo: options.demo,
    });

    const result = await this.databaseService.query<{
      value: string;
      count: string;
    }>(
      `
        SELECT tag AS value, COUNT(*)::text AS count
        FROM questions, unnest(tags) AS tag
        ${whereSql}
        ${whereSql ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag <> ''
        GROUP BY tag
        ORDER BY COUNT(*) DESC, tag ASC
      `,
      params,
    );

    return result.rows.map((row) => ({
      value: row.value,
      count: Number(row.count),
    }));
  }

  async findOne(
    id: string,
    options: { includeDeleted?: boolean; demo?: boolean } = {},
  ): Promise<Question> {
    const params: unknown[] = [id];
    const demoClause = demoScopeClause(params, options.demo === true);
    let result = await this.databaseService.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE id = $1 AND ${demoClause}${options.includeDeleted ? '' : ' AND deleted = FALSE'}
        LIMIT 1
      `,
      params,
    );

    if (!result.rows[0]) {
      throw apiNotFound(
        ApiErrorCode.QUESTION_NOT_FOUND,
        `Question with id "${id}" not found`,
        { id },
      );
    }

    if (result.rows[0].pending_deletion && !result.rows[0].deleted) {
      await this.databaseService.withTransaction(async (client) => {
        await this.processPendingDeletionsAfterTerminalInterview(client, [id]);
      });

      result = await this.databaseService.query<QuestionRow>(
        `
          ${QUESTION_SELECT}
          WHERE id = $1${options.includeDeleted ? '' : ' AND deleted = FALSE'}
          LIMIT 1
        `,
        [id],
      );

      if (!result.rows[0]) {
        throw new NotFoundException(`Question with id "${id}" not found`);
      }
    }

    const question = this.mapRow(result.rows[0]);

    if (!question.pendingDeletion) {
      return question;
    }

    return {
      ...question,
      blockingInterviews: await this.listBlockingInterviewsForQuestion(id),
    };
  }

  async findOneResolved(
    id: string,
    locale: Locale,
    options: {
      includeDeleted?: boolean;
      includeTranslations?: boolean;
      demo?: boolean;
    } = {},
  ): Promise<ResolvedQuestion> {
    const question = await this.findOne(id, {
      includeDeleted: options.includeDeleted,
      demo: options.demo,
    });
    return this.toResolvedQuestion(question, locale, {
      includeTranslations: options.includeTranslations !== false,
    });
  }

  private async listBlockingInterviewsForQuestion(
    questionId: string,
  ): Promise<QuestionDeleteBlockingInterview[]> {
    return this.databaseService.withClient(async (client) => {
      const rows = await this.findActiveInterviewsUsingQuestion(client, questionId);
      return mapBlockingInterviews(rows);
    });
  }

  async softDelete(id: string): Promise<SoftDeleteQuestionResult> {
    return this.databaseService.withTransaction(async (client) => {
      const existing = await this.lockQuestionForDelete(client, id);
      const blockingInterviews = mapBlockingInterviews(
        await this.findActiveInterviewsUsingQuestion(client, existing.id),
      );

      if (blockingInterviews.length > 0) {
        await this.markPendingDeletion(client, id);
        return {
          id,
          scheduled: true,
          blockingInterviews,
        };
      }

      await this.markDeleted(client, id);
      return { id, deleted: true };
    });
  }

  async softDeleteMany(
    ids: string[],
    locale: Locale,
  ): Promise<{
    deleted: string[];
    scheduled: QuestionDeleteScheduledItem[];
  }> {
    const uniqueIds = Array.from(
      new Set(ids.map((questionId) => questionId.trim()).filter(Boolean)),
    );
    const deleted: string[] = [];
    const scheduled: QuestionDeleteScheduledItem[] = [];

    for (const id of uniqueIds) {
      try {
        await this.databaseService.withTransaction(async (client) => {
          const existing = await this.lockQuestionForDelete(client, id);
          const blockingInterviews = mapBlockingInterviews(
            await this.findActiveInterviewsUsingQuestion(client, existing.id),
          );

          if (blockingInterviews.length > 0) {
            await this.markPendingDeletion(client, id);
            scheduled.push({
              id,
              questionText: existing.questionText,
              reason: buildScheduledDeleteReason(blockingInterviews),
              blockingInterviews,
            });
            return;
          }

          await this.markDeleted(client, id);
          deleted.push(id);
        });
      } catch (err) {
        if (err instanceof NotFoundException) {
          continue;
        }
        throw err;
      }
    }

    if (scheduled.length > 0) {
      const resolvedById = await this.loadResolvedQuestionTexts(
        scheduled.map((item) => item.id),
        locale,
      );
      for (const item of scheduled) {
        item.questionText = resolvedById.get(item.id) ?? item.questionText;
      }
    }

    return { deleted, scheduled };
  }

  private async loadResolvedQuestionTexts(
    ids: string[],
    locale: Locale,
  ): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const result = await this.databaseService.query<QuestionRow>(
      `${QUESTION_SELECT} WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const map = new Map<string, string>();
    for (const row of result.rows) {
      map.set(
        row.id,
        this.toResolvedQuestion(this.mapRow(row), locale).questionText,
      );
    }
    return map;
  }

  async findManyByIdsForUpdate(
    client: PoolClient,
    ids: string[],
    demo = false,
    options: { rejectPendingDeletionFor?: string[] } = {},
  ): Promise<QuestionCore[]> {
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = ids.map((id) => id.trim()).filter(Boolean);
    const params: unknown[] = [uniqueIds];
    // Demo isolation: an actor may only build interviews from questions on its
    // own side of the demo boundary. Out-of-scope ids fall through to the
    // not-found check below rather than being silently mixed into the row.
    const demoClause = demoScopeClause(params, demo);
    const result = await client.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE id = ANY($1::uuid[]) AND ${demoClause}
        FOR UPDATE
      `,
      params,
    );

    const byId = new Map(
      result.rows.map((row) => [row.id, row] as const),
    );

    const missingIds = uniqueIds.filter((id) => !byId.has(id));
    if (missingIds.length > 0) {
      throw apiNotFound(
        ApiErrorCode.QUESTION_NOT_FOUND,
        `Questions not found: ${missingIds.join(', ')}`,
        { ids: missingIds },
      );
    }

    const deletedIds = uniqueIds.filter((id) => byId.get(id)?.deleted);
    if (deletedIds.length > 0) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        `Cannot create an interview with deleted questions. Refresh the question list and remove ${deletedIds.length === 1 ? 'this id' : 'these ids'} from your selection: ${deletedIds.join(', ')}`,
        { ids: deletedIds },
      );
    }

    const pendingDeletionIds = collectPendingDeletionAttachRejectIds(
      options.rejectPendingDeletionFor ?? [],
      (id) => Boolean(byId.get(id)?.pending_deletion),
    );
    if (pendingDeletionIds.length > 0) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        `Cannot create an interview with questions scheduled for deletion. Refresh the question list and remove ${pendingDeletionIds.length === 1 ? 'this id' : 'these ids'} from your selection: ${pendingDeletionIds.join(', ')}`,
        { ids: pendingDeletionIds },
      );
    }

    return uniqueIds.map((id) =>
      this.toQuestionCore(this.mapRow(byId.get(id)!)),
    );
  }

  private async lockQuestionForDelete(
    client: PoolClient,
    id: string,
  ): Promise<Question> {
    const result = await client.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE id = $1 AND deleted = FALSE
        FOR UPDATE
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw apiNotFound(
        ApiErrorCode.QUESTION_NOT_FOUND,
        `Question with id "${id}" not found`,
        { id },
      );
    }

    return this.mapRow(result.rows[0]);
  }

  async flushEligiblePendingDeletions(): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const pending = await client.query<{ id: string }>(
        `
          SELECT id
          FROM questions
          WHERE pending_deletion = TRUE
            AND deleted = FALSE
          FOR UPDATE
        `,
      );

      if (pending.rows.length === 0) {
        return;
      }

      await this.processPendingDeletionsAfterTerminalInterview(
        client,
        pending.rows.map((row) => row.id),
      );
    });
  }

  async processPendingDeletionsAfterTerminalInterview(
    client: PoolClient,
    questionIds: string[],
  ): Promise<void> {
    if (questionIds.length === 0) {
      return;
    }

    const pending = await client.query<{ id: string }>(
      `
        SELECT id
        FROM questions
        WHERE id = ANY($1::uuid[])
          AND pending_deletion = TRUE
          AND deleted = FALSE
        FOR UPDATE
      `,
      [questionIds],
    );

    for (const row of pending.rows) {
      if (await this.hasActiveInterview(client, row.id)) {
        continue;
      }

      await this.markDeleted(client, row.id);
    }
  }

  private async findActiveInterviewsUsingQuestion(
    client: PoolClient,
    questionId: string,
  ): Promise<Array<{ id: string; candidate_name: string }>> {
    const result = await client.query<{ id: string; candidate_name: string }>(
      `
        SELECT id, candidate_name
        FROM interviews
        WHERE status = ANY($1::text[])
          AND questions_json @> $2::jsonb
        ORDER BY created_at ASC
      `,
      [
        [...ACTIVE_INTERVIEW_STATUSES],
        JSON.stringify([{ id: questionId }]),
      ],
    );

    return result.rows;
  }

  private async hasActiveInterview(
    client: PoolClient,
    questionId: string,
  ): Promise<boolean> {
    const activeInterviews = await this.findActiveInterviewsUsingQuestion(
      client,
      questionId,
    );
    return activeInterviews.length > 0;
  }

  private async markDeleted(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `
        UPDATE questions
        SET deleted = TRUE, pending_deletion = FALSE, updated_at = NOW()
        WHERE id = $1
      `,
      [id],
    );
  }

  private async markPendingDeletion(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `
        UPDATE questions
        SET pending_deletion = TRUE, updated_at = NOW()
        WHERE id = $1
      `,
      [id],
    );
  }

  async restore(id: string): Promise<Question> {
    return this.databaseService.withTransaction(async (client) => {
      const existing = await this.lockQuestionForRestore(client, id);
      if (!existing.deleted) {
        throw apiBadRequest(ApiErrorCode.BAD_REQUEST, 'Question is not deleted', { id });
      }

      await this.assertNoActiveDuplicate(client, existing);

      const result = await this.runWithDuplicateGuard(existing, () =>
        client.query<QuestionRow>(
          `
            UPDATE questions
            SET deleted = FALSE, pending_deletion = FALSE, updated_at = NOW()
            WHERE id = $1
            ${QUESTION_RETURNING}
          `,
          [id],
        ),
      );

      return this.mapRow(result.rows[0]);
    });
  }

  async restoreResolved(
    id: string,
    locale: Locale,
    options: { includeTranslations?: boolean } = {},
  ): Promise<ResolvedQuestion> {
    const question = await this.restore(id);
    return this.toResolvedQuestion(question, locale, {
      includeTranslations: options.includeTranslations === true,
    });
  }

  private getDbError(err: unknown): {
    code?: string;
    constraint?: string;
    detail?: string;
  } {
    if (typeof err !== 'object' || err === null) {
      return {};
    }
    const dbErr = err as { code?: string; constraint?: string; detail?: string };
    return {
      code: dbErr.code,
      constraint: dbErr.constraint,
      detail: dbErr.detail,
    };
  }

  private async runWithDuplicateGuard<T>(
    payload: { externalId?: string; questionText: string },
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      const dbErr = this.getDbError(err);
      if (dbErr.code === '23505' && dbErr.constraint === 'questions_external_id_unique_idx') {
        throw apiConflict(
          ApiErrorCode.QUESTION_DUPLICATE,
          `An active question with external_id "${payload.externalId}" already exists.`,
          { externalId: payload.externalId },
        );
      }
      if (dbErr.code === '23505' && dbErr.constraint === 'questions_active_text_unique_idx') {
        throw apiConflict(
          ApiErrorCode.QUESTION_DUPLICATE,
          'An active question with the same text already exists.',
        );
      }
      if (dbErr.code === '23505') {
        const detail = (dbErr.detail ?? '').toLowerCase();
        if (detail.includes('external_id')) {
          throw apiConflict(
            ApiErrorCode.QUESTION_DUPLICATE,
            `An active question with external_id "${payload.externalId}" already exists.`,
            { externalId: payload.externalId },
          );
        }
        if (
          detail.includes('question_text') ||
          detail.includes('lower(question_text)') ||
          detail.includes('(text)')
        ) {
          throw apiConflict(
            ApiErrorCode.QUESTION_DUPLICATE,
            'An active question with the same text already exists.',
          );
        }
        this.logger.warn(
          `unmapped unique violation while saving question: constraint="${dbErr.constraint ?? 'unknown'}" detail="${dbErr.detail ?? ''}"`,
        );
      }
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: string }).code === '54000'
      ) {
        throw apiBadRequest(
          ApiErrorCode.BAD_REQUEST,
          'Question text is too long to enforce uniqueness — please shorten it.',
        );
      }
      throw err;
    }
  }

  private async lockQuestionForRestore(
    client: PoolClient,
    id: string,
  ): Promise<Question> {
    const result = await client.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw apiNotFound(
        ApiErrorCode.QUESTION_NOT_FOUND,
        `Question with id "${id}" not found`,
        { id },
      );
    }

    return this.mapRow(result.rows[0]);
  }

  private async assertNoActiveDuplicate(
    client: PoolClient,
    question: Question,
  ): Promise<void> {
    if (question.externalId) {
      const externalIdMatch = await client.query<{ id: string }>(
        `
          SELECT id
          FROM questions
          WHERE external_id = $1
            AND deleted = FALSE
            AND id <> $2
          LIMIT 1
        `,
        [question.externalId, question.id],
      );

      if (externalIdMatch.rows[0]) {
        throw apiConflict(
          ApiErrorCode.QUESTION_DUPLICATE,
          `Cannot restore: an active question with external_id "${question.externalId}" already exists (id: ${externalIdMatch.rows[0].id}).`,
          { externalId: question.externalId, existingId: externalIdMatch.rows[0].id },
        );
      }
    }

    const textVariants = collectQuestionTextVariants(
      question.questionText,
      question.translations,
    );
    const duplicateId = await this.findCrossLocaleTextDuplicateId(
      client,
      textVariants,
      question.id,
    );
    if (duplicateId) {
      throw apiConflict(
        ApiErrorCode.QUESTION_DUPLICATE,
        `Cannot restore: an active question with the same text already exists (id: ${duplicateId}).`,
        { existingId: duplicateId },
      );
    }
  }

  private async findCrossLocaleTextDuplicateId(
    executor: QueryExecutor,
    textVariants: string[],
    excludeId?: string,
  ): Promise<string | undefined> {
    if (textVariants.length === 0) {
      return undefined;
    }

    const params: unknown[] = [textVariants];
    let excludeClause = '';
    if (excludeId) {
      params.push(excludeId);
      excludeClause = `AND id <> $${params.length}`;
    }

    const textMatch = await executor.query<{ id: string }>(
      `
        SELECT id
        FROM questions
        WHERE deleted = FALSE
          ${excludeClause}
          AND (
            lower(question_text) = ANY($1::text[])
            OR EXISTS (
              SELECT 1
              FROM jsonb_each(translations_json) AS tr(locale_key, block)
              WHERE lower(trim(block->>'questionText')) = ANY($1::text[])
            )
          )
        LIMIT 1
      `,
      params,
    );

    return textMatch.rows[0]?.id;
  }

  private async assertNoCrossLocaleTextDuplicate(
    executor: QueryExecutor,
    questionText: string,
    translations: QuestionTranslations,
    excludeId?: string,
  ): Promise<void> {
    const duplicateId = await this.findCrossLocaleTextDuplicateId(
      executor,
      collectQuestionTextVariants(questionText, translations),
      excludeId,
    );
    if (duplicateId) {
      throw apiConflict(
        ApiErrorCode.QUESTION_DUPLICATE,
        'An active question with the same text already exists.',
      );
    }
  }

  async findSimilar(
    draft: Partial<Pick<QuestionCore, 'questionText' | 'category' | 'subcategory' | 'role' | 'difficulty'>>,
    limit: number,
    excludeQuestionId: string | undefined,
    locale: Locale,
    demo = false,
  ): Promise<SimilarQuestionMatch[]> {
    const text = draft.questionText?.trim();
    if (!text) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'draft.questionText is required',
      );
    }

    const vector = await this.embeddingsService.generate(text);
    const literal = `[${vector.join(',')}]`;

    const params: unknown[] = [
      literal,
      this.embeddingsService.model,
      excludeQuestionId ?? null,
      SIMILARITY_DISTANCE_THRESHOLD,
      limit,
    ];
    const demoClause = demoScopeClause(params, demo, 'q.demo');

    const result = await this.databaseService.query<QuestionRow & { distance: number }>(
      `
        SELECT
          ${QUESTION_Q_COLUMNS},
          (e.embedding <=> $1::vector) AS distance
        FROM question_embeddings e
        INNER JOIN questions q ON q.id = e.question_id
        WHERE e.model = $2
          AND q.id IS DISTINCT FROM $3::uuid
          AND q.deleted = FALSE
          AND ${demoClause}
          AND (e.embedding <=> $1::vector) <= $4::float
        ORDER BY distance ASC
        LIMIT $5
      `,
      params,
    );

    return result.rows.map((row) => {
      const question = this.mapRow(row);
      const score = Math.max(0, 1 - Number(row.distance));
      return {
        question: this.toResolvedQuestion(question, locale),
        score,
        reasons: this.buildSimilarReasons(draft, question, locale),
      };
    });
  }

  private buildSimilarReasons(
    draft: Partial<Pick<QuestionCore, 'category' | 'subcategory' | 'role' | 'difficulty'>>,
    match: Question,
    locale: Locale,
  ): string[] {
    const text = localeUiText(locale);
    const reasons: string[] = [];
    if (draft.category && draft.category === match.category) {
      reasons.push(text.similarSameCategory(match.category));
    }
    if (draft.subcategory && draft.subcategory === match.subcategory) {
      reasons.push(text.similarSameSubcategory(match.subcategory));
    }
    if (draft.role && draft.role === match.role) {
      reasons.push(text.similarSameRole(match.role));
    }
    if (draft.difficulty && draft.difficulty === match.difficulty) {
      reasons.push(text.similarSameDifficulty(match.difficulty));
    }
    return reasons;
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<Question> {
    const existing = await this.findOne(id);
    const payload = this.normalizeUpdateQuestionInput(dto, existing);

    const question = await this.updateQuestionRow(
      this.databaseService,
      id,
      payload,
    );
    await this.storeEmbedding(question.id, this.embeddingSourceText(question));
    return question;
  }

  async updateResolved(
    id: string,
    dto: UpdateQuestionDto,
    locale: Locale,
  ): Promise<ResolvedQuestion> {
    const question = await this.update(id, dto);
    return this.toResolvedQuestion(question, locale, { includeTranslations: true });
  }

  hydrateStoredQuestionCore(value: unknown): QuestionCore {
    const record =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    const expectedConcepts = Array.isArray(record.expectedConcepts)
      ? this.normalizeExpectedConcepts(
          record.expectedConcepts as Array<string | Partial<QuestionExpectedConcept>>,
        )
      : [];
    const redFlags = Array.isArray(record.redFlags)
      ? this.normalizeRedFlags(
          record.redFlags as Array<string | Partial<QuestionRedFlag>>,
        )
      : [];

    const outputLanguage =
      this.normalizeOptionalString(record.outputLanguage as string) ?? 'English';
    const primaryLocale =
      typeof record.primaryLocale === 'string' && isLocale(record.primaryLocale)
        ? record.primaryLocale
        : mapOutputLanguageToPrimaryLocale(outputLanguage);
    const legacy = {
      questionText:
        this.normalizeOptionalString(record.questionText as string) ??
        this.normalizeOptionalString(record.text as string) ??
        '',
      followUpQuestions: Array.isArray(record.followUpQuestions)
        ? this.normalizeStringList(record.followUpQuestions as string[])
        : [],
      expectedConcepts,
      redFlags,
      sampleGoodAnswer: this.normalizeOptionalString(record.sampleGoodAnswer as string),
    };
    const translations = ensurePrimaryTranslationBlock(
      primaryLocale,
      parseTranslationsJson(record.translations),
      legacy,
    );
    const resolved = resolveQuestionFields(primaryLocale, translations, legacy);

    return {
      id: String(record.id ?? ''),
      externalId: this.normalizeOptionalString(record.externalId as string),
      role: this.normalizeOptionalString(record.role as string),
      focus: this.normalizeOptionalString(record.focus as string),
      primaryLocale: resolved.primaryLocale,
      translations: resolved.translations,
      outputLanguage: primaryLocaleToOutputLanguage(resolved.primaryLocale),
      category: this.normalizeOptionalString(record.category as string),
      subcategory: this.normalizeOptionalString(record.subcategory as string),
      questionText: resolved.questionText,
      followUpQuestions: this.normalizeStringList(resolved.followUpQuestions),
      expectedConcepts: this.normalizeExpectedConcepts(resolved.expectedConcepts),
      redFlags: this.normalizeRedFlags(resolved.redFlags),
      difficulty: this.normalizeDifficulty(record.difficulty),
      weight: this.normalizeWeight(record.weight),
      sampleGoodAnswer: this.normalizeOptionalString(resolved.sampleGoodAnswer),
      minimumPassScore: this.normalizeMinimumPassScore(
        record.minimumPassScore,
      ),
      tags: Array.isArray(record.tags)
        ? this.normalizeStringList(record.tags as string[])
        : [],
      metadata: this.normalizeMetadata(
        (record.metadata as Record<string, unknown>) ?? {},
      ),
    };
  }

  private normalizeUpdateQuestionInput(
    dto: UpdateQuestionDto,
    existing: Question,
  ): QuestionDraft {
    rejectPrimaryLocaleChange(existing.primaryLocale, dto.primaryLocale);

    const primaryLocale = existing.primaryLocale;
    const translationsMode = dto.translationsMode ?? 'merge';

    if (translationsMode === 'replace' && !dto.translations) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'translations is required when translationsMode is replace',
      );
    }

    let translations: QuestionTranslations = { ...existing.translations };

    if (dto.translations) {
      const patchesPrimary = Object.prototype.hasOwnProperty.call(
        dto.translations,
        primaryLocale,
      );
      const requirePrimary =
        translationsMode === 'replace' || patchesPrimary;
      const incoming = this.normalizeTranslationsInput(
        asQuestionTranslationsMapInput(dto.translations),
        {
        requirePrimaryLocale: requirePrimary ? primaryLocale : undefined,
      },
      );
      translations = applyTranslationsUpdate(
        existing.translations,
        incoming,
        translationsMode,
      );
    } else if (this.hasLegacyLocalizedPatch(dto)) {
      translations = mergeTranslations(
        translations,
        primaryLocale,
        buildTranslation({
          questionText: dto.questionText ?? existing.questionText,
          followUpQuestions:
            dto.followUpQuestions ?? existing.followUpQuestions,
          expectedConcepts:
            dto.expectedConcepts !== undefined
              ? this.normalizeExpectedConcepts(dto.expectedConcepts)
              : existing.expectedConcepts,
          redFlags:
            dto.redFlags !== undefined
              ? this.normalizeRedFlags(dto.redFlags)
              : existing.redFlags,
          sampleGoodAnswer: dto.sampleGoodAnswer ?? existing.sampleGoodAnswer,
        }),
      );
    }

    const primary = translations[primaryLocale];
    if (!this.isPrimaryTranslationComplete(primary)) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        `translations must include a complete block for primaryLocale "${primaryLocale}"`,
        { primaryLocale },
      );
    }

    this.assertOptionalNumber(dto.minimumPassScore, 'minimumPassScore');
    const weight = Number(dto.weight ?? existing.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Question weight must be greater than 0',
      );
    }

    const minimumPassScore = Number(dto.minimumPassScore ?? existing.minimumPassScore);
    if (!Number.isFinite(minimumPassScore) || minimumPassScore < 0 || minimumPassScore > 5) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Minimum pass score must be between 0 and 5',
      );
    }

    return {
      externalId: this.normalizeOptionalString(dto.externalId) ?? existing.externalId,
      role: this.normalizeOptionalString(dto.role) ?? existing.role,
      focus: this.normalizeOptionalString(dto.focus) ?? existing.focus,
      primaryLocale,
      translations,
      outputLanguage: primaryLocaleToOutputLanguage(primaryLocale),
      category: this.normalizeOptionalString(dto.category) ?? existing.category,
      subcategory: this.normalizeOptionalString(dto.subcategory) ?? existing.subcategory,
      questionText: primary.questionText,
      followUpQuestions: primary.followUpQuestions ?? [],
      expectedConcepts: primary.expectedConcepts ?? [],
      redFlags: primary.redFlags ?? [],
      difficulty: dto.difficulty ?? existing.difficulty,
      weight: Number(weight.toFixed(2)),
      sampleGoodAnswer: primary.sampleGoodAnswer ?? '',
      minimumPassScore: Number(minimumPassScore.toFixed(2)),
      tags: this.normalizeStringList(dto.tags ?? existing.tags),
      metadata: this.normalizeMetadata(dto.metadata ?? existing.metadata),
    };
  }

  private hasLegacyLocalizedPatch(dto: UpdateQuestionDto): boolean {
    return (
      dto.questionText !== undefined ||
      dto.followUpQuestions !== undefined ||
      dto.expectedConcepts !== undefined ||
      dto.redFlags !== undefined ||
      dto.sampleGoodAnswer !== undefined
    );
  }

  private normalizeCreateQuestionInput(dto: CreateQuestionDto): QuestionDraft {
    const translations = this.normalizeTranslationsInput(
      asQuestionTranslationsMapInput(dto.translations),
      {
      requirePrimaryLocale: dto.primaryLocale,
    },
    );
    const primary = translations[dto.primaryLocale];
    if (!this.isPrimaryTranslationComplete(primary)) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        `translations must include a complete block for primaryLocale "${dto.primaryLocale}"`,
        { primaryLocale: dto.primaryLocale },
      );
    }

    this.assertOptionalNumber(dto.minimumPassScore, 'minimumPassScore');
    const weight = Number(dto.weight ?? 1);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Question weight must be greater than 0',
      );
    }

    const minimumPassScore = Number(dto.minimumPassScore ?? 0);
    if (!Number.isFinite(minimumPassScore) || minimumPassScore < 0 || minimumPassScore > 5) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Minimum pass score must be between 0 and 5',
      );
    }

    return {
      externalId: this.normalizeOptionalString(dto.externalId),
      role: this.normalizeOptionalString(dto.role),
      focus: this.normalizeOptionalString(dto.focus),
      primaryLocale: dto.primaryLocale,
      translations,
      outputLanguage: primaryLocaleToOutputLanguage(dto.primaryLocale),
      category: this.normalizeOptionalString(dto.category),
      subcategory: this.normalizeOptionalString(dto.subcategory),
      questionText: primary.questionText,
      followUpQuestions: primary.followUpQuestions ?? [],
      expectedConcepts: primary.expectedConcepts ?? [],
      redFlags: primary.redFlags ?? [],
      difficulty: dto.difficulty ?? 'medium',
      weight: Number(weight.toFixed(2)),
      sampleGoodAnswer: primary.sampleGoodAnswer ?? '',
      minimumPassScore: Number(minimumPassScore.toFixed(2)),
      tags: this.normalizeStringList(dto.tags),
      metadata: this.normalizeMetadata(dto.metadata),
    };
  }

  private normalizeTranslationsInput(
    raw: QuestionTranslationsMapInput,
    options: { requirePrimaryLocale?: Locale } = {},
  ): QuestionTranslations {
    const unknownKeys = findUnknownTranslationLocaleKeys(
      raw as Record<string, unknown>,
    );
    if (unknownKeys.length > 0) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        `Unknown translations locale keys: ${unknownKeys.join(', ')}. Supported: ${SUPPORTED_LOCALES.join(', ')}.`,
        { field: 'translations' },
      );
    }

    const translations: QuestionTranslations = {};
    for (const locale of SUPPORTED_LOCALES) {
      const block = raw[locale];
      if (!block) {
        continue;
      }
      const followUpQuestions = Array.isArray(block.followUpQuestions)
        ? this.normalizeStringList(block.followUpQuestions)
        : undefined;
      const expectedConcepts = Array.isArray(block.expectedConcepts)
        ? this.normalizeExpectedConcepts(block.expectedConcepts)
        : undefined;
      const redFlags = Array.isArray(block.redFlags)
        ? this.normalizeRedFlags(block.redFlags)
        : undefined;
      const sampleGoodAnswer =
        typeof block.sampleGoodAnswer === 'string'
          ? block.sampleGoodAnswer.trim()
          : undefined;
      translations[locale] = {
        questionText: block.questionText.trim(),
        ...(followUpQuestions !== undefined ? { followUpQuestions } : {}),
        ...(expectedConcepts !== undefined ? { expectedConcepts } : {}),
        ...(redFlags !== undefined ? { redFlags } : {}),
        ...(sampleGoodAnswer !== undefined ? { sampleGoodAnswer } : {}),
      };
    }
    const requiredPrimary = options.requirePrimaryLocale;
    if (requiredPrimary && !this.isPrimaryTranslationComplete(translations[requiredPrimary])) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        `translations must include a complete block for primaryLocale "${requiredPrimary}"`,
        { primaryLocale: requiredPrimary },
      );
    }
    return translations;
  }

  private isPrimaryTranslationComplete(
    translation: QuestionTranslations[Locale] | undefined,
  ): translation is QuestionTranslation & {
    followUpQuestions: string[];
    expectedConcepts: QuestionExpectedConcept[];
    redFlags: QuestionRedFlag[];
    sampleGoodAnswer: string;
  } {
    return Boolean(
      translation &&
        translation.questionText.trim() &&
        Array.isArray(translation.followUpQuestions) &&
        Array.isArray(translation.expectedConcepts) &&
        Array.isArray(translation.redFlags) &&
        typeof translation.sampleGoodAnswer === 'string' &&
        translation.sampleGoodAnswer.trim(),
    );
  }

  private normalizeQuestionInput(dto: {
    externalId?: string;
    role?: string;
    focus?: string;
    primaryLocale?: Locale;
    outputLanguage?: string;
    translations?: QuestionTranslations;
    category?: string;
    subcategory?: string;
    questionText: string;
    followUpQuestions?: string[];
    expectedConcepts?: Array<string | Partial<QuestionExpectedConcept>>;
    redFlags?: Array<string | Partial<QuestionRedFlag>>;
    difficulty?: QuestionDifficulty;
    weight?: number;
    sampleGoodAnswer?: string;
    minimumPassScore?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): QuestionDraft {
    const questionText = dto.questionText.trim();
    if (!questionText) {
      throw apiBadRequest(ApiErrorCode.VALIDATION_ERROR, 'Question text is required');
    }

    const weight = Number(dto.weight ?? 1);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Question weight must be greater than 0',
      );
    }

    const minimumPassScore = Number(dto.minimumPassScore ?? 0);
    if (!Number.isFinite(minimumPassScore) || minimumPassScore < 0 || minimumPassScore > 5) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Minimum pass score must be between 0 and 5',
      );
    }

    const followUpQuestions = this.normalizeStringList(dto.followUpQuestions);
    const expectedConcepts = this.normalizeExpectedConcepts(dto.expectedConcepts);
    const redFlags = this.normalizeRedFlags(dto.redFlags);
    const sampleGoodAnswer = this.normalizeOptionalString(dto.sampleGoodAnswer);
    const primaryLocale =
      dto.primaryLocale && isLocale(dto.primaryLocale)
        ? dto.primaryLocale
        : mapOutputLanguageToPrimaryLocale(
            this.normalizeOptionalString(dto.outputLanguage) ?? 'English',
          );
    const translation = buildTranslation({
      questionText,
      followUpQuestions,
      expectedConcepts,
      redFlags,
      sampleGoodAnswer,
    });
    const translations = mergeTranslations(dto.translations, primaryLocale, translation);

    return {
      externalId: this.normalizeOptionalString(dto.externalId),
      role: this.normalizeOptionalString(dto.role),
      focus: this.normalizeOptionalString(dto.focus),
      primaryLocale,
      translations,
      outputLanguage: primaryLocaleToOutputLanguage(primaryLocale),
      category: this.normalizeOptionalString(dto.category),
      subcategory: this.normalizeOptionalString(dto.subcategory),
      questionText,
      followUpQuestions,
      expectedConcepts,
      redFlags,
      difficulty: dto.difficulty ?? 'medium',
      weight: Number(weight.toFixed(2)),
      sampleGoodAnswer,
      minimumPassScore: Number(minimumPassScore.toFixed(2)),
      tags: this.normalizeStringList(dto.tags),
      metadata: this.normalizeMetadata(dto.metadata),
    };
  }

  private normalizeStringList(items?: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const item of items ?? []) {
      const value = this.normalizeOptionalString(item);
      if (!value) {
        continue;
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(value);
    }

    return normalized;
  }

  private normalizeDifficulty(value: unknown): QuestionDifficulty {
    return value === 'easy' || value === 'medium' || value === 'hard'
      ? value
      : 'medium';
  }

  private normalizeWeight(value: unknown): number {
    const numeric = Number(value ?? 1);
    return Number.isFinite(numeric) && numeric > 0
      ? Number(numeric.toFixed(2))
      : 1;
  }

  private normalizeMinimumPassScore(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return Number(Math.min(5, numeric).toFixed(2));
  }

  private normalizeExpectedConcepts(
    items?: unknown[],
  ): QuestionExpectedConcept[] {
    const normalized = (items ?? [])
      .map((item) => {
        if (typeof item === 'string') {
          const label = this.normalizeOptionalString(item);
          return label
            ? {
                id: this.slugify(label),
                label,
                weight: 1,
                description: `${label} should be covered in the answer.`,
              }
            : null;
        }

        const tuple = this.parseExpectedConceptTuple(item);
        if (tuple) {
          const label = this.normalizeOptionalString(tuple.label);
          const description =
            this.normalizeOptionalString(tuple.description) ??
            (label ? `${label} should be covered in the answer.` : undefined);
          if (!label || !description) {
            return null;
          }
          return {
            id: this.normalizeOptionalString(tuple.id) ?? this.slugify(label),
            label,
            weight: Number(tuple.weight ?? 1),
            description,
          };
        }

        if (!this.isRecord(item)) {
          return null;
        }

        const label = this.normalizeOptionalString(
          typeof item.label === 'string' ? item.label : undefined,
        );
        const description =
          this.normalizeOptionalString(
            typeof item.description === 'string' ? item.description : undefined,
          ) ??
          (label ? `${label} should be covered in the answer.` : undefined);

        if (!label || !description) {
          return null;
        }

        return {
          id: this.normalizeOptionalString(
            typeof item.id === 'string' ? item.id : undefined,
          ) ?? this.slugify(label),
          label,
          weight: Number(
            typeof item.weight === 'number' || typeof item.weight === 'string'
              ? item.weight
              : 1,
          ),
          description,
        };
      })
      .filter((item): item is QuestionExpectedConcept => Boolean(item));

    if (normalized.length === 0) {
      return [];
    }

    const allWeightsValid = normalized.every(
      (item) => Number.isFinite(item.weight) && item.weight > 0,
    );
    const rawWeights = allWeightsValid
      ? normalized.map((item) => item.weight)
      : normalized.map(() => 1);
    const total = rawWeights.reduce((sum, weight) => sum + weight, 0);

    let accumulated = 0;
    return normalized.map((item, index) => {
      const isLast = index === normalized.length - 1;
      const normalizedWeight = isLast
        ? Number((1 - accumulated).toFixed(4))
        : Number((rawWeights[index] / total).toFixed(4));
      accumulated = Number((accumulated + normalizedWeight).toFixed(4));

      return {
        ...item,
        weight: normalizedWeight > 0 ? normalizedWeight : Number((1 / normalized.length).toFixed(4)),
      };
    });
  }

  private normalizeRedFlags(
    items?: unknown[],
  ): QuestionRedFlag[] {
    return (items ?? [])
      .map((item) => {
        if (typeof item === 'string') {
          const label = this.normalizeOptionalString(item);
          return label
            ? {
                id: this.slugify(label),
                label,
                severity: 'medium' as const,
              }
            : null;
        }

        const tuple = this.parseRedFlagTuple(item);
        if (tuple) {
          const label = this.normalizeOptionalString(tuple.label);
          if (!label) {
            return null;
          }
          return {
            id: this.normalizeOptionalString(tuple.id) ?? this.slugify(label),
            label,
            severity: this.normalizeSeverity(tuple.severity),
          };
        }

        if (!this.isRecord(item)) {
          return null;
        }

        const label = this.normalizeOptionalString(
          typeof item.label === 'string' ? item.label : undefined,
        );
        if (!label) {
          return null;
        }

        return {
          id: this.normalizeOptionalString(
            typeof item.id === 'string' ? item.id : undefined,
          ) ?? this.slugify(label),
          label,
          severity: this.normalizeSeverity(
            typeof item.severity === 'string' ? item.severity : undefined,
          ),
        };
      })
      .filter((item): item is QuestionRedFlag => Boolean(item));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private parseExpectedConceptTuple(item: unknown): {
    id?: string;
    label?: string;
    weight?: number;
    description?: string;
  } | null {
    if (!Array.isArray(item)) {
      return null;
    }

    if (item.length >= 4) {
      return {
        id: typeof item[0] === 'string' ? item[0] : undefined,
        label: typeof item[1] === 'string' ? item[1] : undefined,
        weight: typeof item[2] === 'number' ? item[2] : Number(item[2]),
        description: typeof item[3] === 'string' ? item[3] : undefined,
      };
    }

    if (item.length >= 3) {
      return {
        label: typeof item[0] === 'string' ? item[0] : undefined,
        weight: typeof item[1] === 'number' ? item[1] : Number(item[1]),
        description: typeof item[2] === 'string' ? item[2] : undefined,
      };
    }

    return null;
  }

  private parseRedFlagTuple(item: unknown): {
    id?: string;
    label?: string;
    severity?: string;
  } | null {
    if (!Array.isArray(item)) {
      return null;
    }

    if (item.length >= 3) {
      return {
        id: typeof item[0] === 'string' ? item[0] : undefined,
        label: typeof item[1] === 'string' ? item[1] : undefined,
        severity: typeof item[2] === 'string' ? item[2] : undefined,
      };
    }

    if (
      item.length >= 2 &&
      typeof item[0] === 'string' &&
      (item[1] === 'low' || item[1] === 'medium' || item[1] === 'high')
    ) {
      return {
        label: item[0],
        severity: item[1],
      };
    }

    return null;
  }

  private normalizeSeverity(value?: string): QuestionRedFlagSeverity {
    return value === 'low' || value === 'medium' || value === 'high'
      ? value
      : 'medium';
  }

  private assertOptionalNumber(value: unknown, field: string): void {
    if (value === undefined) {
      return;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        `${field} must be a number`,
        { field },
      );
    }
  }

  private normalizeMetadata(
    value?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {};
    }
    return value;
  }

  private normalizeOptionalString(value?: string | null): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private parseExpectedConcepts(
    structuredItems: unknown[] | null,
    legacyItems: string[] | null,
  ): QuestionExpectedConcept[] {
    if (Array.isArray(structuredItems) && structuredItems.length > 0) {
      return this.normalizeExpectedConcepts(
        structuredItems as Array<string | Partial<QuestionExpectedConcept>>,
      );
    }

    return this.normalizeExpectedConcepts(legacyItems ?? []);
  }

  private parseRedFlags(
    structuredItems: unknown[] | null,
    legacyItems: string[] | null,
  ): QuestionRedFlag[] {
    if (Array.isArray(structuredItems) && structuredItems.length > 0) {
      return this.normalizeRedFlags(
        structuredItems as Array<string | Partial<QuestionRedFlag>>,
      );
    }

    return this.normalizeRedFlags(legacyItems ?? []);
  }

  private toQuestionCore(question: Question): QuestionCore {
    return {
      id: question.id,
      externalId: question.externalId,
      role: question.role,
      focus: question.focus,
      primaryLocale: question.primaryLocale,
      translations: question.translations,
      outputLanguage: question.outputLanguage,
      category: question.category,
      subcategory: question.subcategory,
      questionText: question.questionText,
      followUpQuestions: question.followUpQuestions,
      expectedConcepts: question.expectedConcepts,
      redFlags: question.redFlags,
      difficulty: question.difficulty,
      weight: question.weight,
      sampleGoodAnswer: question.sampleGoodAnswer,
      minimumPassScore: question.minimumPassScore,
      tags: question.tags,
      metadata: question.metadata,
    };
  }

  private mapRow(row: QuestionRow): Question {
    const primaryLocale = resolvePrimaryLocale(
      row.primary_locale,
      row.output_language,
    );
    const translations = parseTranslationsJson(row.translations_json);
    const legacy: QuestionLegacyFields = {
      questionText:
        this.normalizeOptionalString(row.question_text) ?? row.text,
      followUpQuestions: row.follow_up_questions ?? [],
      expectedConcepts: this.parseExpectedConcepts(
        row.expected_concepts_json,
        row.expected_concepts,
      ),
      redFlags: this.parseRedFlags(row.red_flags_json, row.red_flags),
      sampleGoodAnswer: this.normalizeOptionalString(row.sample_good_answer),
    };
    const hydratedTranslations = ensurePrimaryTranslationBlock(
      primaryLocale,
      translations,
      legacy,
    );
    const primaryBlock = hydratedTranslations[primaryLocale];
    const flatFields =
      primaryBlock?.questionText?.trim()
        ? {
            questionText: primaryBlock.questionText,
            followUpQuestions: primaryBlock.followUpQuestions ?? [],
            expectedConcepts: primaryBlock.expectedConcepts ?? [],
            redFlags: primaryBlock.redFlags ?? [],
            sampleGoodAnswer: primaryBlock.sampleGoodAnswer,
          }
        : {
            questionText: legacy.questionText,
            followUpQuestions: this.normalizeStringList(legacy.followUpQuestions),
            expectedConcepts: this.normalizeExpectedConcepts(
              legacy.expectedConcepts,
            ),
            redFlags: this.normalizeRedFlags(legacy.redFlags),
            sampleGoodAnswer: legacy.sampleGoodAnswer,
          };

    return {
      id: row.id,
      externalId: this.normalizeOptionalString(row.external_id),
      role: this.normalizeOptionalString(row.role),
      focus: this.normalizeOptionalString(row.focus),
      primaryLocale,
      translations: hydratedTranslations,
      outputLanguage: primaryLocaleToOutputLanguage(primaryLocale),
      category: this.normalizeOptionalString(row.category),
      subcategory: this.normalizeOptionalString(row.subcategory),
      questionText: flatFields.questionText,
      followUpQuestions: flatFields.followUpQuestions,
      expectedConcepts: flatFields.expectedConcepts,
      redFlags: flatFields.redFlags,
      difficulty: row.difficulty,
      weight: row.weight,
      sampleGoodAnswer: this.normalizeOptionalString(flatFields.sampleGoodAnswer),
      minimumPassScore: Number((row.minimum_pass_score ?? 0).toFixed(2)),
      tags: row.tags ?? [],
      metadata: this.normalizeMetadata(row.metadata ?? {}),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deleted: Boolean(row.deleted),
      usageCount: Number(row.usage_count ?? 0),
      pendingDeletion: Boolean(row.pending_deletion)
    };
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || crypto.randomUUID();
  }
}
