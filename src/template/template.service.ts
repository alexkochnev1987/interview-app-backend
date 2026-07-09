import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { demoScopeClause } from '../common/demo-scope';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest, apiNotFound } from '../common/errors/api-error';
import { Locale } from '../locale/locale.constants';
import {
  QuestionService,
  ResolvedQuestion,
} from '../question/question.service';
import { Template } from './interfaces/template.interface';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

// Stored ids expanded to live question rows for the request locale; omits raw questionIds.
export interface TemplateWithQuestions extends Omit<Template, 'questionIds'> {
  questions: ResolvedQuestion[];
  // Count of currently-resolvable questions (deleted/pending refs excluded).
  questionCount: number;
  // Count of ids stored on the template, including refs that no longer resolve;
  // lets the client tell when some saved questions are no longer available.
  storedQuestionCount: number;
}

// List shape: summary fields only, no resolved questions array (the list view
// never reads it). Keeps both counts so the UI can still flag stale references.
export interface TemplateSummary extends Omit<Template, 'questionIds'> {
  questionCount: number;
  storedQuestionCount: number;
}

const TEMPLATE_COLUMNS = `
  id,
  name,
  description,
  position,
  question_ids_json,
  created_by_id,
  demo,
  usage_count,
  created_at,
  updated_at
`;

const TEMPLATE_SELECT = `SELECT ${TEMPLATE_COLUMNS} FROM interview_templates`;
const TEMPLATE_RETURNING = `RETURNING ${TEMPLATE_COLUMNS}`;

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  position: string | null;
  question_ids_json: string[] | null;
  created_by_id: string | null;
  demo: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

interface TemplateContext {
  createdById?: string;
  demo?: boolean;
}

type QueryExecutor = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

@Injectable()
export class TemplateService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly questionService: QuestionService,
  ) {}

  async create(
    dto: CreateTemplateDto,
    locale: Locale,
    context: TemplateContext = {},
  ): Promise<TemplateWithQuestions> {
    const questionIds = this.normalizeIds(dto.questionIds);
    if (questionIds.length === 0) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'At least one question must be selected',
      );
    }

    const demo = context.demo === true;
    // Reject ids that do not resolve to live, in-scope questions so a template is
    // never persisted dead on arrival (mirrors the id check in interview create).
    const questions = await this.questionService.resolveExistingByIds(
      questionIds,
      locale,
      { demo },
    );
    this.assertAllResolved(questionIds, questions);

    const result = await this.databaseService.query<TemplateRow>(
      `
        INSERT INTO interview_templates (
          id,
          name,
          description,
          position,
          question_ids_json,
          created_by_id,
          demo
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        ${TEMPLATE_RETURNING}
      `,
      [
        randomUUID(),
        dto.name.trim(),
        this.normalizeOptional(dto.description),
        this.normalizeOptional(dto.position),
        JSON.stringify(questionIds),
        context.createdById ?? null,
        demo,
      ],
    );

    return this.toResponse(this.mapRow(result.rows[0]), questions);
  }

  async findAll(
    locale: Locale,
    options: { demo?: boolean } = {},
  ): Promise<TemplateSummary[]> {
    const demo = options.demo === true;
    const params: unknown[] = [];
    const demoClause = demoScopeClause(params, demo);
    const result = await this.databaseService.query<TemplateRow>(
      `
        ${TEMPLATE_SELECT}
        WHERE ${demoClause}
        ORDER BY updated_at DESC
      `,
      params,
    );

    // One query resolves the union of referenced ids so each row can report its
    // resolvable count; the summaries themselves omit the heavy questions array.
    const templates = result.rows.map((row) => this.mapRow(row));
    const uniqueIds = Array.from(
      new Set(templates.flatMap((template) => template.questionIds)),
    );
    const resolved = await this.questionService.resolveExistingByIds(
      uniqueIds,
      locale,
      { demo },
    );
    const resolvableIds = new Set(resolved.map((question) => question.id));
    return templates.map((template) =>
      this.toSummary(
        template,
        template.questionIds.filter((id) => resolvableIds.has(id)).length,
      ),
    );
  }

  async findOne(
    id: string,
    locale: Locale,
    options: { demo?: boolean } = {},
  ): Promise<TemplateWithQuestions> {
    const row = await this.findRow(id, options.demo === true);
    return this.resolve(this.mapRow(row), locale);
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    locale: Locale,
    options: { demo?: boolean } = {},
  ): Promise<TemplateWithQuestions> {
    const hasUpdate =
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.position !== undefined ||
      dto.questionIds !== undefined;
    if (!hasUpdate) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'At least one field must be provided',
      );
    }

    const demo = options.demo === true;
    const { updated, resolvedQuestions } =
      await this.databaseService.withTransaction(async (client) => {
        // Lock the row so a concurrent update/delete can't race the demo scope.
        const existing = await this.findRow(id, demo, client);

        const name = dto.name !== undefined ? dto.name.trim() : existing.name;
        const description =
          dto.description !== undefined
            ? this.normalizeOptional(dto.description)
            : existing.description;
        const position =
          dto.position !== undefined
            ? this.normalizeOptional(dto.position)
            : existing.position;

        let questionIds = existing.question_ids_json ?? [];
        let resolvedQuestions: ResolvedQuestion[] | null = null;
        if (dto.questionIds !== undefined) {
          questionIds = this.normalizeIds(dto.questionIds);
          if (questionIds.length === 0) {
            throw apiBadRequest(
              ApiErrorCode.BAD_REQUEST,
              'A template must contain at least one question',
            );
          }
          // Same guard as create: a replacement set must resolve to live questions.
          resolvedQuestions = await this.questionService.resolveExistingByIds(
            questionIds,
            locale,
            { demo },
          );
          this.assertAllResolved(questionIds, resolvedQuestions);
        }

        const result = await client.query<TemplateRow>(
          `
          UPDATE interview_templates
          SET
            name = $2,
            description = $3,
            position = $4,
            question_ids_json = $5::jsonb,
            updated_at = NOW()
          WHERE id = $1
          ${TEMPLATE_RETURNING}
        `,
          [
            id,
            name,
            description,
            position,
            JSON.stringify(questionIds),
          ],
        );

        return { updated: this.mapRow(result.rows[0]), resolvedQuestions };
      });

    // Reuse the set already resolved for validation; otherwise resolve the
    // unchanged stored ids after commit (no live read under the FOR UPDATE lock).
    if (resolvedQuestions) {
      return this.toResponse(updated, resolvedQuestions);
    }
    return this.resolve(updated, locale);
  }

  async remove(
    id: string,
    options: { demo?: boolean } = {},
  ): Promise<{ id: string; deleted: true }> {
    const params: unknown[] = [id];
    const demoClause = demoScopeClause(params, options.demo === true);
    const result = await this.databaseService.query(
      `DELETE FROM interview_templates WHERE id = $1 AND ${demoClause}`,
      params,
    );
    if ((result.rowCount ?? 0) === 0) {
      throw this.notFound(id);
    }
    return { id, deleted: true };
  }

  private async findRow(
    id: string,
    demo: boolean,
    client?: PoolClient,
  ): Promise<TemplateRow> {
    const params: unknown[] = [id];
    const demoClause = demoScopeClause(params, demo);
    const executor: QueryExecutor = client ?? this.databaseService;
    const result = await executor.query<TemplateRow>(
      `
        ${TEMPLATE_SELECT}
        WHERE id = $1 AND ${demoClause}
        LIMIT 1
        ${client ? 'FOR UPDATE' : ''}
      `,
      params,
    );
    if (!result.rows[0]) {
      throw this.notFound(id);
    }
    return result.rows[0];
  }

  private async resolve(
    template: Template,
    locale: Locale,
  ): Promise<TemplateWithQuestions> {
    const questions = await this.questionService.resolveExistingByIds(
      template.questionIds,
      locale,
      { demo: template.demo },
    );
    return this.toResponse(template, questions);
  }

  private toResponse(
    template: Template,
    questions: ResolvedQuestion[],
  ): TemplateWithQuestions {
    // Expose resolved `questions` only; the raw questionIds stay internal.
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      position: template.position,
      createdById: template.createdById,
      demo: template.demo,
      usageCount: template.usageCount,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      questions,
      questionCount: questions.length,
      storedQuestionCount: template.questionIds.length,
    };
  }

  private toSummary(
    template: Template,
    questionCount: number,
  ): TemplateSummary {
    // Same fields as the full response minus the resolved questions array.
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      position: template.position,
      createdById: template.createdById,
      demo: template.demo,
      usageCount: template.usageCount,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      questionCount,
      storedQuestionCount: template.questionIds.length,
    };
  }

  private mapRow(row: TemplateRow): Template {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      position: row.position ?? undefined,
      questionIds: Array.isArray(row.question_ids_json)
        ? row.question_ids_json
        : [],
      createdById: row.created_by_id ?? undefined,
      demo: row.demo,
      usageCount: Number(row.usage_count ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private normalizeIds(ids: string[]): string[] {
    return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  }

  // Every requested id must map to a live, in-scope question; otherwise the
  // caller selected something deleted, pending deletion, or out of demo scope.
  private assertAllResolved(
    questionIds: string[],
    resolved: ResolvedQuestion[],
  ): void {
    if (resolved.length !== questionIds.length) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'One or more selected questions are unavailable in this workspace; refresh the question list and try again',
      );
    }
  }

  private normalizeOptional(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private notFound(id: string) {
    return apiNotFound(
      ApiErrorCode.NOT_FOUND,
      `Template with id "${id}" not found`,
      { id },
    );
  }
}
