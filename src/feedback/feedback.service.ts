import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import {
  apiConflict,
  apiForbidden,
  apiNotFound,
} from '../common/errors/api-error';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DatabaseError } from 'pg';
import { DatabaseService } from '../database/database.service';
import { InterviewService } from '../interview/interview.service';
import {
  Interview,
  InterviewDecision,
} from '../interview/interfaces/interview.interface';
import { UserRole } from '../user/interfaces/user.interface';
import {
  FeedbackLink,
  FeedbackResponse,
} from './interfaces/feedback-link.interface';
import { buildFeedbackImprovements } from './feedback-text';

export const FEEDBACK_LINK_TTL_DAYS = 7;

const POSTGRES_UNIQUE_VIOLATION = '23505';

interface FeedbackLinkRow {
  id: string;
  interview_id: string;
  created_by_id: string | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

interface FeedbackActor {
  id: string;
  role: UserRole;
  demo: boolean;
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly interviewService: InterviewService,
  ) {}

  async createLink(
    interviewId: string,
    actor: FeedbackActor,
  ): Promise<{ link: FeedbackLink; url: string; token: string }> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      actor,
    );
    if (interview.status !== 'completed' || !interview.result) {
      throw apiForbidden(
        ApiErrorCode.FORBIDDEN,
        'Feedback link can only be generated for a completed interview',
        { interviewId },
      );
    }

    try {
      return await this.databaseService.withTransaction(async (client) => {
        await client.query(
          `
            UPDATE feedback_links
            SET revoked_at = NOW()
            WHERE interview_id = $1 AND revoked_at IS NULL
          `,
          [interviewId],
        );

        const linkId = randomUUID();
        const token = this.generateToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = new Date(
          Date.now() + FEEDBACK_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        // Plaintext token is delivered once via the URL below; the DB only
        // stores its sha256 hash so a DB compromise does not yield usable
        // tokens. The unique index on the `token` column is preserved by
        // storing the (also-unique) hash in the same column.
        const result = await client.query<FeedbackLinkRow>(
          `
            INSERT INTO feedback_links (
              id,
              interview_id,
              created_by_id,
              expires_at,
              token
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, interview_id, created_by_id, expires_at, revoked_at, created_at
          `,
          [linkId, interviewId, actor.id, expiresAt, tokenHash],
        );

        const link = this.mapRow(result.rows[0]);
        const baseUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') ?? '';
        return {
          link,
          token,
          url: `${baseUrl}/feedback/${interviewId}?token=${token}`,
        };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw apiConflict(
          ApiErrorCode.CONFLICT,
          'Another feedback link was created concurrently. Try again.',
          { interviewId },
        );
      }
      throw error;
    }
  }

  async revokeActiveLink(
    interviewId: string,
    actor: FeedbackActor,
  ): Promise<{ revoked: boolean }> {
    await this.interviewService.findOneForActor(interviewId, actor);

    const result = await this.databaseService.query(
      `
        UPDATE feedback_links
        SET revoked_at = NOW()
        WHERE interview_id = $1 AND revoked_at IS NULL
      `,
      [interviewId],
    );

    return { revoked: (result.rowCount ?? 0) > 0 };
  }

  async resolveByToken(
    interviewId: string,
    token: string,
  ): Promise<FeedbackResponse> {
    const tokenHash = this.hashToken(token);
    const result = await this.databaseService.query<FeedbackLinkRow>(
      `
        SELECT id, interview_id, created_by_id, expires_at, revoked_at, created_at
        FROM feedback_links
        WHERE token = $1
        LIMIT 1
      `,
      [tokenHash],
    );

    const linkRow = result.rows[0];
    if (
      !linkRow ||
      linkRow.interview_id !== interviewId ||
      linkRow.revoked_at !== null ||
      (linkRow.expires_at !== null && linkRow.expires_at.getTime() <= Date.now())
    ) {
      throw apiNotFound(
        ApiErrorCode.NOT_FOUND,
        'Invalid or expired feedback link',
        { interviewId },
      );
    }

    const interview = await this.interviewService.findOne(interviewId);
    if (interview.status !== 'completed' || !interview.result) {
      throw apiNotFound(
        ApiErrorCode.NOT_FOUND,
        'Feedback is not available for this interview',
        { interviewId },
      );
    }

    return this.toFeedbackResponse(interview, linkRow);
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof DatabaseError && error.code === POSTGRES_UNIQUE_VIOLATION
    );
  }

  private toFeedbackResponse(
    interview: Interview,
    linkRow: FeedbackLinkRow,
  ): FeedbackResponse {
    const result = interview.result;
    if (!result) {
      throw new InternalServerErrorException('Interview result is missing');
    }
    if (!linkRow.expires_at) {
      throw new InternalServerErrorException('Feedback link has no expiry');
    }
    return {
      interviewLocale: interview.interviewLocale,
      position: interview.position,
      date: result.completedAt.toISOString(),
      expiresAt: linkRow.expires_at.toISOString(),
      overallResult: this.mapDecision(result.decision),
      overallScore: result.overallScore,
      categoryScores: result.categoryScores,
      generalFeedback: result.summary,
      improvements:
        result.improvements ??
        (result.questionResults
          ? buildFeedbackImprovements(
              result.questionResults,
              interview.interviewLocale,
            )
          : undefined),
      questionResults: result.questionResults?.map((item) => ({
        questionIndex: item.questionIndex,
        questionId: item.questionId,
        score: item.score,
        decisionHint: item.decisionHint,
        summary: item.summary,
      })),
    };
  }

  private mapDecision(
    decision?: InterviewDecision,
  ): FeedbackResponse['overallResult'] {
    switch (decision) {
      case 'proceed':
        return 'pass';
      case 'review':
        return 'borderline';
      case 'reject':
        return 'fail';
      default:
        return undefined;
    }
  }

  private mapRow(row: FeedbackLinkRow): FeedbackLink {
    return {
      id: row.id,
      interviewId: row.interview_id,
      createdById: row.created_by_id ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      revokedAt: row.revoked_at ?? undefined,
      createdAt: row.created_at,
    };
  }
}
