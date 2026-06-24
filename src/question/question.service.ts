import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { EmbeddingsService } from '../ai/embeddings/embeddings.service';
import { demoScopeClause } from '../common/demo-scope';
import { DatabaseService } from '../database/database.service';
import { ACTIVE_INTERVIEW_STATUSES } from '../interview/interfaces/interview.interface';
import { CreateQuestionDto } from './dto/create-question.dto';
import {
  QueryQuestionsDto,
  QuestionSortField,
  QuestionSortOrder,
  QuestionStatusFilter,
} from './dto/query-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  Question,
  QuestionCore,
  QuestionDifficulty,
  QuestionDraft,
  QuestionExpectedConcept,
  QuestionRedFlag,
  QuestionRedFlagSeverity,
  SimilarQuestionMatch,
} from './interfaces/question.interface';

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
  items: Question[];
  total: number;
  page: number;
  limit: number;
}

export type FacetField =
  | 'difficulty'
  | 'category'
  | 'subcategory'
  | 'role'
  | 'outputLanguage'
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
}

const SIMILARITY_SCORE_THRESHOLD = 0.6;
const SIMILARITY_DISTANCE_THRESHOLD = 1 - SIMILARITY_SCORE_THRESHOLD;

const QUESTION_COLUMNS = `
  id,
  external_id,
  role,
  focus,
  output_language,
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
  usage_count
`;

const QUESTION_SELECT = `SELECT ${QUESTION_COLUMNS} FROM questions`;
const QUESTION_RETURNING = `RETURNING ${QUESTION_COLUMNS}`;

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

  private async storeEmbedding(
    questionId: string,
    text: string,
  ): Promise<void> {
    try {
      await this.embeddingsService.generateAndStore(questionId, text);
    } catch (err) {
      this.logger.warn(
        `failed to store embedding for question ${questionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async create(dto: CreateQuestionDto): Promise<Question> {
    const payload = this.normalizeQuestionInput(dto);
    const question = await this.insertQuestionRow(
      this.databaseService,
      payload,
    );
    await this.storeEmbedding(question.id, question.questionText);
    return question;
  }

  async upsertImportedQuestion(dto: CreateQuestionDto): Promise<Question> {
    const normalized = this.normalizeQuestionInput(dto);

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

    await this.storeEmbedding(question.id, question.questionText);
    return question;
  }

  private async insertQuestionRow(
    executor: QueryExecutor,
    payload: QuestionDraft,
  ): Promise<Question> {
    const result = await this.runWithDuplicateGuard(payload, () =>
      executor.query<QuestionRow>(
        `
          INSERT INTO questions (
            id,
            external_id,
            role,
            focus,
            output_language,
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
            metadata
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12::jsonb, $13, $14::jsonb, $15, $16, $17, $18, $19, $20::jsonb
          )
          ${QUESTION_RETURNING}
        `,
        [
          crypto.randomUUID(),
          payload.externalId ?? null,
          payload.role ?? null,
          payload.focus ?? null,
          payload.outputLanguage,
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
    const result = await this.runWithDuplicateGuard(payload, () =>
      executor.query<QuestionRow>(
        `
          UPDATE questions
          SET
            external_id = $2,
            role = $3,
            focus = $4,
            output_language = $5,
            category = $6,
            subcategory = $7,
            text = $8,
            question_text = $9,
            follow_up_questions = $10,
            expected_concepts = $11,
            expected_concepts_json = $12::jsonb,
            red_flags = $13,
            red_flags_json = $14::jsonb,
            difficulty = $15,
            weight = $16,
            sample_good_answer = $17,
            minimum_pass_score = $18,
            tags = $19,
            metadata = $20::jsonb,
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
    options: { forceActive?: boolean; demo?: boolean } = {},
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
    const items = result.rows.map((row) => this.mapRow(row));

    return { items, total, page, limit };
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
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
      whereClauses.push('deleted = FALSE');
    } else if (status === 'inactive') {
      whereClauses.push('deleted = TRUE');
    }

    if (query.q) {
      params.push(`%${this.escapeLike(query.q)}%`);
      const i = params.length;
      whereClauses.push(`(
        question_text ILIKE $${i}
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

    if (query.outputLanguage && options.excludeField !== 'outputLanguage') {
      params.push(query.outputLanguage.toLowerCase());
      whereClauses.push(`lower(output_language) = $${params.length}`);
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
    const result = await this.databaseService.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE id = $1 AND ${demoClause}${options.includeDeleted ? '' : ' AND deleted = FALSE'}
        LIMIT 1
      `,
      params,
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Question with id "${id}" not found`);
    }

    return this.mapRow(result.rows[0]);
  }

  async softDelete(id: string): Promise<{ id: string; deleted: true }> {
    return this.databaseService.withTransaction(async (client) => {
      const existing = await this.lockQuestionForDelete(client, id);
      await this.assertNoActiveInterview(client, existing);
      await this.markDeleted(client, id);
      return { id, deleted: true };
    });
  }

  async softDeleteMany(
    ids: string[],
  ): Promise<{
    deleted: string[];
    blocked: Array<{ id: string; questionText: string; reason: string }>;
  }> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const deleted: string[] = [];
    const blocked: Array<{ id: string; questionText: string; reason: string }> = [];

    for (const id of uniqueIds) {
      try {
        await this.databaseService.withTransaction(async (client) => {
          const existing = await this.lockQuestionForDelete(client, id);
          await this.assertNoActiveInterview(client, existing);
          await this.markDeleted(client, id);
          deleted.push(id);
        });
      } catch (err) {
        if (err instanceof NotFoundException) {
          continue;
        }
        if (err instanceof ConflictException) {
          const existing = await this.findOne(id).catch(() => undefined);
          blocked.push({
            id,
            questionText: existing?.questionText ?? '',
            reason: err.message,
          });
          continue;
        }
        throw err;
      }
    }

    return { deleted, blocked };
  }

  async findManyByIdsForUpdate(
    client: PoolClient,
    ids: string[],
    demo = false,
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
      throw new NotFoundException(
        `Questions not found: ${missingIds.join(', ')}`,
      );
    }

    const deletedIds = uniqueIds.filter((id) => byId.get(id)?.deleted);
    if (deletedIds.length > 0) {
      throw new BadRequestException(
        `Cannot create an interview with deleted questions. Refresh the question list and remove ${deletedIds.length === 1 ? 'this id' : 'these ids'} from your selection: ${deletedIds.join(', ')}`,
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
      throw new NotFoundException(`Question with id "${id}" not found`);
    }

    return this.mapRow(result.rows[0]);
  }

  private async assertNoActiveInterview(
    client: PoolClient,
    question: Question,
  ): Promise<void> {
    const result = await client.query<{
      id: string;
      candidate_name: string;
    }>(
      `
        SELECT id, candidate_name
        FROM interviews
        WHERE status = ANY($1::text[])
          AND questions_json @> $2::jsonb
        LIMIT 1
      `,
      [
        [...ACTIVE_INTERVIEW_STATUSES],
        JSON.stringify([{ id: question.id }]),
      ],
    );

    if (result.rows[0]) {
      throw new ConflictException(
        `Question is used by an active interview (candidate: ${result.rows[0].candidate_name}). Wait for it to finish before deleting.`,
      );
    }
  }

  private async markDeleted(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `UPDATE questions SET deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async restore(id: string): Promise<Question> {
    return this.databaseService.withTransaction(async (client) => {
      const existing = await this.lockQuestionForRestore(client, id);
      if (!existing.deleted) {
        throw new BadRequestException('Question is not deleted');
      }

      await this.assertNoActiveDuplicate(client, existing);

      const result = await this.runWithDuplicateGuard(existing, () =>
        client.query<QuestionRow>(
          `
            UPDATE questions
            SET deleted = FALSE, updated_at = NOW()
            WHERE id = $1
            ${QUESTION_RETURNING}
          `,
          [id],
        ),
      );

      return this.mapRow(result.rows[0]);
    });
  }

  private getUniqueViolationConstraint(err: unknown): string | undefined {
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === '23505'
    ) {
      return (err as { constraint?: string }).constraint;
    }
    return undefined;
  }

  private async runWithDuplicateGuard<T>(
    payload: { externalId?: string; questionText: string },
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      const constraint = this.getUniqueViolationConstraint(err);
      if (constraint === 'questions_external_id_unique_idx') {
        throw new ConflictException(
          `An active question with external_id "${payload.externalId}" already exists.`,
        );
      }
      if (constraint === 'questions_active_text_unique_idx') {
        throw new ConflictException(
          'An active question with the same text already exists.',
        );
      }
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: string }).code === '54000'
      ) {
        throw new BadRequestException(
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
      throw new NotFoundException(`Question with id "${id}" not found`);
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
        throw new ConflictException(
          `Cannot restore: an active question with external_id "${question.externalId}" already exists (id: ${externalIdMatch.rows[0].id}).`,
        );
      }
    }

    const textMatch = await client.query<{ id: string }>(
      `
        SELECT id
        FROM questions
        WHERE lower(question_text) = lower($1)
          AND deleted = FALSE
          AND id <> $2
        LIMIT 1
      `,
      [question.questionText, question.id],
    );

    if (textMatch.rows[0]) {
      throw new ConflictException(
        `Cannot restore: an active question with the same text already exists (id: ${textMatch.rows[0].id}).`,
      );
    }
  }

  async findSimilar(
    draft: Partial<Pick<QuestionCore, 'questionText' | 'category' | 'subcategory' | 'role' | 'difficulty'>>,
    limit: number,
    excludeQuestionId: string | undefined,
    demo = false,
  ): Promise<SimilarQuestionMatch[]> {
    const text = draft.questionText?.trim();
    if (!text) {
      throw new BadRequestException('draft.questionText is required');
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
          q.id,
          q.external_id,
          q.role,
          q.focus,
          q.output_language,
          q.category,
          q.subcategory,
          q.text,
          q.question_text,
          q.follow_up_questions,
          q.expected_concepts,
          q.expected_concepts_json,
          q.red_flags,
          q.red_flags_json,
          q.difficulty,
          q.weight,
          q.sample_good_answer,
          q.minimum_pass_score,
          q.tags,
          q.metadata,
          q.created_at,
          q.updated_at,
          q.deleted,
          q.usage_count,
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
        question,
        score,
        reasons: this.buildSimilarReasons(draft, question),
      };
    });
  }

  private buildSimilarReasons(
    draft: Partial<Pick<QuestionCore, 'category' | 'subcategory' | 'role' | 'difficulty'>>,
    match: Question,
  ): string[] {
    const reasons: string[] = [];
    if (draft.category && draft.category === match.category) {
      reasons.push(`Same category: ${match.category}`);
    }
    if (draft.subcategory && draft.subcategory === match.subcategory) {
      reasons.push(`Same subcategory: ${match.subcategory}`);
    }
    if (draft.role && draft.role === match.role) {
      reasons.push(`Same role: ${match.role}`);
    }
    if (draft.difficulty && draft.difficulty === match.difficulty) {
      reasons.push(`Same difficulty: ${match.difficulty}`);
    }
    return reasons;
  }

  async update(id: string, dto: UpdateQuestionDto | QuestionDraft): Promise<Question> {
    const existing = await this.findOne(id);
    const payload = this.normalizeQuestionInput({
      externalId: dto.externalId ?? existing.externalId,
      role: dto.role ?? existing.role,
      focus: dto.focus ?? existing.focus,
      outputLanguage: dto.outputLanguage ?? existing.outputLanguage,
      category: dto.category ?? existing.category,
      subcategory: dto.subcategory ?? existing.subcategory,
      questionText: dto.questionText ?? existing.questionText,
      followUpQuestions: dto.followUpQuestions ?? existing.followUpQuestions,
      expectedConcepts: dto.expectedConcepts ?? existing.expectedConcepts,
      redFlags: dto.redFlags ?? existing.redFlags,
      difficulty: dto.difficulty ?? existing.difficulty,
      weight: dto.weight ?? existing.weight,
      sampleGoodAnswer: dto.sampleGoodAnswer ?? existing.sampleGoodAnswer,
      minimumPassScore: dto.minimumPassScore ?? existing.minimumPassScore,
      tags: dto.tags ?? existing.tags,
      metadata: dto.metadata ?? existing.metadata,
    });

    const question = await this.updateQuestionRow(
      this.databaseService,
      id,
      payload,
    );
    await this.storeEmbedding(question.id, question.questionText);
    return question;
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

    return {
      id: String(record.id ?? ''),
      externalId: this.normalizeOptionalString(record.externalId as string),
      role: this.normalizeOptionalString(record.role as string),
      focus: this.normalizeOptionalString(record.focus as string),
      outputLanguage:
        this.normalizeOptionalString(record.outputLanguage as string) ?? 'English',
      category: this.normalizeOptionalString(record.category as string),
      subcategory: this.normalizeOptionalString(record.subcategory as string),
      questionText:
        this.normalizeOptionalString(record.questionText as string) ??
        this.normalizeOptionalString(record.text as string) ??
        '',
      followUpQuestions: Array.isArray(record.followUpQuestions)
        ? this.normalizeStringList(record.followUpQuestions as string[])
        : [],
      expectedConcepts,
      redFlags,
      difficulty: this.normalizeDifficulty(record.difficulty),
      weight: this.normalizeWeight(record.weight),
      sampleGoodAnswer: this.normalizeOptionalString(
        record.sampleGoodAnswer as string,
      ),
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

  private normalizeQuestionInput(dto: {
    externalId?: string;
    role?: string;
    focus?: string;
    outputLanguage?: string;
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
      throw new BadRequestException('Question text is required');
    }

    const weight = Number(dto.weight ?? 1);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new BadRequestException('Question weight must be greater than 0');
    }

    const minimumPassScore = Number(dto.minimumPassScore ?? 0);
    if (!Number.isFinite(minimumPassScore) || minimumPassScore < 0 || minimumPassScore > 5) {
      throw new BadRequestException('Minimum pass score must be between 0 and 5');
    }

    return {
      externalId: this.normalizeOptionalString(dto.externalId),
      role: this.normalizeOptionalString(dto.role),
      focus: this.normalizeOptionalString(dto.focus),
      outputLanguage: this.normalizeOptionalString(dto.outputLanguage) ?? 'English',
      category: this.normalizeOptionalString(dto.category),
      subcategory: this.normalizeOptionalString(dto.subcategory),
      questionText,
      followUpQuestions: this.normalizeStringList(dto.followUpQuestions),
      expectedConcepts: this.normalizeExpectedConcepts(dto.expectedConcepts),
      redFlags: this.normalizeRedFlags(dto.redFlags),
      difficulty: dto.difficulty ?? 'medium',
      weight: Number(weight.toFixed(2)),
      sampleGoodAnswer: this.normalizeOptionalString(dto.sampleGoodAnswer),
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
    items?: Array<string | Partial<QuestionExpectedConcept>>,
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

        const label = this.normalizeOptionalString(item.label);
        const description =
          this.normalizeOptionalString(item.description) ??
          (label ? `${label} should be covered in the answer.` : undefined);

        if (!label || !description) {
          return null;
        }

        return {
          id: this.normalizeOptionalString(item.id) ?? this.slugify(label),
          label,
          weight: Number(item.weight ?? 1),
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
    items?: Array<string | Partial<QuestionRedFlag>>,
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

        const label = this.normalizeOptionalString(item.label);
        if (!label) {
          return null;
        }

        return {
          id: this.normalizeOptionalString(item.id) ?? this.slugify(label),
          label,
          severity: this.normalizeSeverity(item.severity),
        };
      })
      .filter((item): item is QuestionRedFlag => Boolean(item));
  }

  private normalizeSeverity(value?: string): QuestionRedFlagSeverity {
    return value === 'low' || value === 'medium' || value === 'high'
      ? value
      : 'medium';
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
    return {
      id: row.id,
      externalId: this.normalizeOptionalString(row.external_id),
      role: this.normalizeOptionalString(row.role),
      focus: this.normalizeOptionalString(row.focus),
      outputLanguage:
        this.normalizeOptionalString(row.output_language) ?? 'English',
      category: this.normalizeOptionalString(row.category),
      subcategory: this.normalizeOptionalString(row.subcategory),
      questionText:
        this.normalizeOptionalString(row.question_text) ?? row.text,
      followUpQuestions: row.follow_up_questions ?? [],
      expectedConcepts: this.parseExpectedConcepts(
        row.expected_concepts_json,
        row.expected_concepts,
      ),
      redFlags: this.parseRedFlags(row.red_flags_json, row.red_flags),
      difficulty: row.difficulty,
      weight: row.weight,
      sampleGoodAnswer: this.normalizeOptionalString(row.sample_good_answer),
      minimumPassScore: Number((row.minimum_pass_score ?? 0).toFixed(2)),
      tags: row.tags ?? [],
      metadata: this.normalizeMetadata(row.metadata ?? {}),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deleted: Boolean(row.deleted),
      usageCount: Number(row.usage_count ?? 0),
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
