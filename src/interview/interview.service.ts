import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { QuestionService } from '../question/question.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import {
  Answer,
  Interview,
  InterviewQuestion,
  InterviewResult,
} from './interfaces/interview.interface';

interface InterviewRow {
  id: string;
  candidate_name: string;
  position: string;
  questions_json: InterviewQuestion[] | null;
  answers_json: Answer[] | null;
  status: Interview['status'];
  result_json: InterviewResult | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class InterviewService implements OnModuleInit {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly questionService: QuestionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id UUID PRIMARY KEY,
        candidate_name TEXT NOT NULL,
        position TEXT NOT NULL,
        questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'processing', 'completed', 'failed')),
        result_json JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async create(dto: CreateInterviewDto): Promise<Interview> {
    const candidateName = dto.candidateName.trim();
    const position = dto.position.trim();
    const questionIds = dto.questionIds.map((id) => id.trim()).filter(Boolean);

    if (!candidateName) {
      throw new BadRequestException('Candidate name is required');
    }
    if (!position) {
      throw new BadRequestException('Position is required');
    }
    if (questionIds.length === 0) {
      throw new BadRequestException('At least one question must be selected');
    }

    const questions = await this.questionService.findManyByIds(questionIds);
    const result = await this.databaseService.query<InterviewRow>(
      `
        INSERT INTO interviews (
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
        RETURNING
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        candidateName,
        position,
        JSON.stringify(questions),
        JSON.stringify([]),
        'pending',
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<Interview[]> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        SELECT
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          created_at,
          updated_at
        FROM interviews
        ORDER BY created_at DESC
      `,
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findOne(id: string): Promise<Interview> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        SELECT
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          created_at,
          updated_at
        FROM interviews
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Interview with id "${id}" not found`);
    }

    return this.mapRow(result.rows[0]);
  }

  async complete(id: string): Promise<Interview> {
    const interview = await this.findOne(id);
    const updated = await this.saveInterview({
      ...interview,
      status: 'processing',
      updatedAt: new Date(),
    });

    this.simulateProcessing(updated.id);
    return updated;
  }

  async getResults(id: string): Promise<InterviewResult> {
    const interview = await this.findOne(id);
    if (interview.status !== 'completed' || !interview.result) {
      throw new NotFoundException(
        `Results for interview "${id}" are not available yet (status: ${interview.status})`,
      );
    }
    return interview.result;
  }

  async addAnswer(
    id: string,
    questionIndex: number,
    mediaKey: string,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    if (questionIndex !== interview.answers.length) {
      throw new BadRequestException(
        'Invalid question index — must answer in order',
      );
    }

    const nextAnswers = [
      ...interview.answers,
      {
        questionIndex,
        mediaKey,
        uploadedAt: new Date(),
      },
    ];

    return this.saveInterview({
      ...interview,
      answers: nextAnswers,
      status: 'in_progress',
      updatedAt: new Date(),
    });
  }

  private async saveInterview(interview: Interview): Promise<Interview> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        UPDATE interviews
        SET
          candidate_name = $2,
          position = $3,
          questions_json = $4::jsonb,
          answers_json = $5::jsonb,
          status = $6,
          result_json = $7::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          created_at,
          updated_at
      `,
      [
        interview.id,
        interview.candidateName,
        interview.position,
        JSON.stringify(interview.questions),
        JSON.stringify(interview.answers),
        interview.status,
        interview.result ? JSON.stringify(interview.result) : null,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Placeholder for Step Functions invocation.
   * Simulates async processing by completing after a short delay.
   */
  private simulateProcessing(interviewId: string): void {
    setTimeout(async () => {
      try {
        const interview = await this.findOne(interviewId);
        await this.saveInterview({
          ...interview,
          result: {
            overallScore: 75,
            summary: 'Simulated evaluation result',
            categoryScores: {
              technical: 80,
              communication: 70,
              problemSolving: 75,
            },
            completedAt: new Date(),
          },
          status: 'completed',
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to simulate interview processing', error);
      }
    }, 2000);
  }

  private mapRow(row: InterviewRow): Interview {
    return {
      id: row.id,
      candidateName: row.candidate_name,
      position: row.position,
      questions: row.questions_json ?? [],
      answers: (row.answers_json ?? []).map((answer) => ({
        ...answer,
        uploadedAt: new Date(answer.uploadedAt),
      })),
      status: row.status,
      result: row.result_json
        ? {
            ...row.result_json,
            completedAt: new Date(row.result_json.completedAt),
          }
        : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
