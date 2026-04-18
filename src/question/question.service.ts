import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  Question,
  QuestionCore,
  QuestionDifficulty,
} from './interfaces/question.interface';

interface QuestionRow {
  id: string;
  text: string;
  expected_concepts: string[] | null;
  red_flags: string[] | null;
  difficulty: QuestionDifficulty;
  weight: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class QuestionService implements OnModuleInit {
  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY,
        text TEXT NOT NULL,
        expected_concepts TEXT[] NOT NULL DEFAULT '{}',
        red_flags TEXT[] NOT NULL DEFAULT '{}',
        difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
        weight INTEGER NOT NULL CHECK (weight > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async create(dto: CreateQuestionDto): Promise<Question> {
    const payload = this.normalizeQuestionInput(dto);
    const result = await this.databaseService.query<QuestionRow>(
      `
        INSERT INTO questions (
          id,
          text,
          expected_concepts,
          red_flags,
          difficulty,
          weight
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          text,
          expected_concepts,
          red_flags,
          difficulty,
          weight,
          created_at,
          updated_at
      `,
      [
        crypto.randomUUID(),
        payload.text,
        payload.expectedConcepts,
        payload.redFlags,
        payload.difficulty,
        payload.weight,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<Question[]> {
    const result = await this.databaseService.query<QuestionRow>(
      `
        SELECT
          id,
          text,
          expected_concepts,
          red_flags,
          difficulty,
          weight,
          created_at,
          updated_at
        FROM questions
        ORDER BY updated_at DESC, created_at DESC
      `,
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findOne(id: string): Promise<Question> {
    const result = await this.databaseService.query<QuestionRow>(
      `
        SELECT
          id,
          text,
          expected_concepts,
          red_flags,
          difficulty,
          weight,
          created_at,
          updated_at
        FROM questions
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

  async findManyByIds(ids: string[]): Promise<QuestionCore[]> {
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = ids.map((id) => id.trim()).filter(Boolean);
    const result = await this.databaseService.query<QuestionRow>(
      `
        SELECT
          id,
          text,
          expected_concepts,
          red_flags,
          difficulty,
          weight,
          created_at,
          updated_at
        FROM questions
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

  async update(id: string, dto: UpdateQuestionDto): Promise<Question> {
    const existing = await this.findOne(id);
    const payload = this.normalizeQuestionInput({
      text: dto.text ?? existing.text,
      expectedConcepts: dto.expectedConcepts ?? existing.expectedConcepts,
      redFlags: dto.redFlags ?? existing.redFlags,
      difficulty: dto.difficulty ?? existing.difficulty,
      weight: dto.weight ?? existing.weight,
    });

    const result = await this.databaseService.query<QuestionRow>(
      `
        UPDATE questions
        SET
          text = $2,
          expected_concepts = $3,
          red_flags = $4,
          difficulty = $5,
          weight = $6,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          text,
          expected_concepts,
          red_flags,
          difficulty,
          weight,
          created_at,
          updated_at
      `,
      [
        id,
        payload.text,
        payload.expectedConcepts,
        payload.redFlags,
        payload.difficulty,
        payload.weight,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  private normalizeQuestionInput(dto: {
    text: string;
    expectedConcepts?: string[];
    redFlags?: string[];
    difficulty?: QuestionDifficulty;
    weight?: number;
  }): Omit<QuestionCore, 'id'> {
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Question text is required');
    }

    const weight = Number(dto.weight ?? 1);
    if (!Number.isFinite(weight) || weight < 1) {
      throw new BadRequestException('Question weight must be at least 1');
    }

    return {
      text,
      expectedConcepts: this.normalizeList(dto.expectedConcepts),
      redFlags: this.normalizeList(dto.redFlags),
      difficulty: dto.difficulty ?? 'medium',
      weight: Math.round(weight),
    };
  }

  private normalizeList(items?: string[]): string[] {
    return (items ?? []).map((item) => item.trim()).filter(Boolean);
  }

  private toQuestionCore(question: Question): QuestionCore {
    return {
      id: question.id,
      text: question.text,
      expectedConcepts: question.expectedConcepts,
      redFlags: question.redFlags,
      difficulty: question.difficulty,
      weight: question.weight,
    };
  }

  private mapRow(row: QuestionRow): Question {
    return {
      id: row.id,
      text: row.text,
      expectedConcepts: row.expected_concepts ?? [],
      redFlags: row.red_flags ?? [],
      difficulty: row.difficulty,
      weight: row.weight,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
