import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { EmbeddingsService } from '../ai/embeddings/embeddings.service';
import { DatabaseService } from '../database/database.service';
import { CreateQuestionDto } from './dto/create-question.dto';
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
}

const QUESTION_SELECT = `
  SELECT
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
    updated_at
  FROM questions
`;

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
    const result = await this.databaseService.query<QuestionRow>(
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
        RETURNING
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
          updated_at
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
    );

    const question = this.mapRow(result.rows[0]);
    await this.storeEmbedding(question.id, question.questionText);
    return question;
  }

  async upsertImportedQuestion(dto: CreateQuestionDto): Promise<Question> {
    const normalized = this.normalizeQuestionInput(dto);
    const existing =
      (normalized.externalId
        ? await this.findByExternalId(normalized.externalId)
        : undefined) ??
      (await this.findByQuestionText(normalized.questionText));

    if (!existing) {
      return this.create(normalized);
    }

    return this.update(existing.id, normalized);
  }

  async findAll(): Promise<Question[]> {
    const result = await this.databaseService.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        ORDER BY updated_at DESC, created_at DESC
      `,
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findOne(id: string): Promise<Question> {
    const result = await this.databaseService.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Question with id "${id}" not found`);
    }

    return this.mapRow(result.rows[0]);
  }

  async findSimilar(
    draft: Partial<Pick<QuestionCore, 'questionText' | 'category' | 'subcategory' | 'role' | 'difficulty'>>,
    limit: number,
    excludeQuestionId: string | undefined,
  ): Promise<SimilarQuestionMatch[]> {
    const text = draft.questionText?.trim();
    if (!text) {
      throw new BadRequestException('draft.questionText is required');
    }

    const vector = await this.embeddingsService.generate(text);
    const literal = `[${vector.join(',')}]`;

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
          (e.embedding <=> $1::vector) AS distance
        FROM question_embeddings e
        INNER JOIN questions q ON q.id = e.question_id
        WHERE e.model = $2
          AND q.id IS DISTINCT FROM $3::uuid
        ORDER BY distance ASC
        LIMIT $4
      `,
      [literal, this.embeddingsService.model, excludeQuestionId ?? null, limit],
    );

    return result.rows.map((row) => {
      const question = this.mapRow(row);
      return {
        question,
        score: 1 - Number(row.distance),
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

  async findManyByIds(ids: string[]): Promise<QuestionCore[]> {
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = ids.map((id) => id.trim()).filter(Boolean);
    const result = await this.databaseService.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE id = ANY($1::uuid[])
      `,
      [uniqueIds],
    );

    const byId = new Map(
      result.rows.map((row) => {
        const question = this.mapRow(row);
        return [question.id, this.toQuestionCore(question)] as const;
      }),
    );

    const missingIds = uniqueIds.filter((id) => !byId.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundException(
        `Questions not found: ${missingIds.join(', ')}`,
      );
    }

    return uniqueIds.map((id) => byId.get(id)!);
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

    const result = await this.databaseService.query<QuestionRow>(
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
        RETURNING
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
          updated_at
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
    );

    const question = this.mapRow(result.rows[0]);
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

  private async findByExternalId(externalId: string): Promise<Question | undefined> {
    const result = await this.databaseService.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE external_id = $1
        LIMIT 1
      `,
      [externalId],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
  }

  private async findByQuestionText(questionText: string): Promise<Question | undefined> {
    const result = await this.databaseService.query<QuestionRow>(
      `
        ${QUESTION_SELECT}
        WHERE lower(coalesce(question_text, text)) = lower($1)
        LIMIT 1
      `,
      [questionText],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
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
