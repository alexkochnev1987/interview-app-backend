import { randomUUID } from 'crypto';

import { Injectable, Optional } from '@nestjs/common';

import { AppConfigService } from '../app-config/app-config.service';
import { apiConflict, apiNotFound } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { DatabaseService } from '../database/database.service';
import { Interview } from '../interview/interfaces/interview.interface';
import { InterviewService } from '../interview/interview.service';
import { UserRole } from '../user/interfaces/user.interface';
import { getCandidateFeedbackInterviewStatusBlockReason } from './candidate-feedback-eligibility';
import { CandidateFeedbackService } from './candidate-feedback.service';
import {
  calculateFeedbackShareExpiry,
  generateFeedbackShareToken,
  hashFeedbackShareToken,
  isPostgresUniqueViolation,
} from './feedback-share-token';
import { FEEDBACK_LINK_TTL_DAYS } from './feedback.service';
import {
  CandidateFeedbackShareLink,
  PublicCandidateFeedbackResponse,
} from './interfaces/candidate-feedback-share-link.interface';
import {
  hasAnyPublishableCandidateFeedbackBlock,
  presentPublicCandidateFeedback,
} from './present-public-candidate-feedback';

/** Same TTL as scoring feedback share links. */
export const CANDIDATE_FEEDBACK_SHARE_LINK_TTL_DAYS = FEEDBACK_LINK_TTL_DAYS;

interface CandidateFeedbackShareLinkRow {
  id: string;
  interview_id: string;
  created_by_id: string | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface ShareLinkActor {
  id: string;
  role: UserRole;
  demo: boolean;
}

@Injectable()
export class CandidateFeedbackShareService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly interviewService: InterviewService,
    private readonly candidateFeedbackService: CandidateFeedbackService,
    @Optional() private readonly appConfig?: AppConfigService,
  ) {}

  async createLink(
    interviewId: string,
    actor: ShareLinkActor,
  ): Promise<{
    link: CandidateFeedbackShareLink;
    url: string;
    token: string;
    expiresAt: Date;
  }> {
    if (
      (await this.appConfig?.getBoolean(
        'ENABLE_FEEDBACK_SHARE_LINKS',
        true,
      )) === false
    ) {
      throw apiConflict(
        ApiErrorCode.FORBIDDEN,
        'Candidate feedback share links are currently disabled via runtime config.',
      );
    }

    const interview = await this.interviewService.findOneForActor(
      interviewId,
      actor,
    );
    this.assertInterviewReadyForShare(interview);

    const feedback =
      await this.candidateFeedbackService.findByInterviewId(interviewId);

    if (!feedback || !hasAnyPublishableCandidateFeedbackBlock(feedback)) {
      throw apiConflict(
        ApiErrorCode.CONFLICT,
        'Cannot create a share link without at least one accepted or edited candidate-feedback block that has publishable text',
        { interviewId },
      );
    }

    try {
      return await this.databaseService.withAdvisoryLock(
        `candidate-feedback:${interviewId}`,
        async () => {
          const lockedFeedback =
            await this.candidateFeedbackService.findByInterviewId(interviewId);
          if (
            !lockedFeedback ||
            !hasAnyPublishableCandidateFeedbackBlock(lockedFeedback)
          ) {
            throw apiConflict(
              ApiErrorCode.CONFLICT,
              'Cannot create a share link without at least one accepted or edited candidate-feedback block that has publishable text',
              { interviewId },
            );
          }

          return await this.databaseService.withTransaction(async (client) => {
            await client.query(
              `
            UPDATE candidate_feedback_share_links
            SET revoked_at = NOW()
            WHERE interview_id = $1 AND revoked_at IS NULL
          `,
              [interviewId],
            );

            const linkId = randomUUID();
            const token = generateFeedbackShareToken();
            const tokenHash = hashFeedbackShareToken(token);
            const expiresAt = calculateFeedbackShareExpiry(
              CANDIDATE_FEEDBACK_SHARE_LINK_TTL_DAYS,
            );

            // Plaintext token is delivered once via the URL below; the DB only
            // stores its sha256 hash so a DB compromise does not yield usable
            // tokens. The unique index on the `token` column is preserved by
            // storing the (also-unique) hash in the same column.
            const result = await client.query<CandidateFeedbackShareLinkRow>(
              `
            INSERT INTO candidate_feedback_share_links (
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
              expiresAt,
              url: `${baseUrl}/feedback/share/${token}`,
            };
          });
        },
      );
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw apiConflict(
          ApiErrorCode.CONFLICT,
          'Another candidate-feedback share link was created concurrently. Try again.',
          { interviewId },
        );
      }
      throw error;
    }
  }

  async revokeActiveLink(
    interviewId: string,
    actor: ShareLinkActor,
  ): Promise<{ revoked: boolean }> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      actor,
    );
    this.assertInterviewReadyForShare(interview);

    const result = await this.databaseService.query(
      `
        UPDATE candidate_feedback_share_links
        SET revoked_at = NOW()
        WHERE interview_id = $1 AND revoked_at IS NULL
      `,
      [interviewId],
    );

    return { revoked: (result.rowCount ?? 0) > 0 };
  }

  async getActiveLinkStatus(
    interviewId: string,
    actor: ShareLinkActor,
  ): Promise<{ expiresAt: Date }> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      actor,
    );
    this.assertInterviewReadyForShare(interview);

    const expiresAt = await this.findActiveShareLinkExpiresAt(interviewId);
    if (!expiresAt) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'No active candidate-feedback share link',
        { interviewId },
      );
    }

    const feedback =
      await this.candidateFeedbackService.findByInterviewId(interviewId);
    if (!feedback || !hasAnyPublishableCandidateFeedbackBlock(feedback)) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'No active candidate-feedback share link',
        { interviewId },
      );
    }

    return { expiresAt };
  }

  async hasActiveShareLink(interviewId: string): Promise<boolean> {
    const expiresAt = await this.findActiveShareLinkExpiresAt(interviewId);
    if (expiresAt == null) {
      return false;
    }

    const feedback =
      await this.candidateFeedbackService.findByInterviewId(interviewId);
    return !!feedback && hasAnyPublishableCandidateFeedbackBlock(feedback);
  }

  private async findActiveShareLinkExpiresAt(
    interviewId: string,
  ): Promise<Date | null> {
    const result = await this.databaseService.query<{
      expires_at: Date | null;
    }>(
      `
        SELECT expires_at
        FROM candidate_feedback_share_links
        WHERE interview_id = $1
          AND revoked_at IS NULL
          AND expires_at IS NOT NULL
          AND expires_at > NOW()
        LIMIT 1
      `,
      [interviewId],
    );

    return result.rows[0]?.expires_at ?? null;
  }

  async resolveByToken(
    token: string,
  ): Promise<PublicCandidateFeedbackResponse> {
    const tokenHash = hashFeedbackShareToken(token);
    const result =
      await this.databaseService.query<CandidateFeedbackShareLinkRow>(
        `
        SELECT id, interview_id, created_by_id, expires_at, revoked_at, created_at
        FROM candidate_feedback_share_links
        WHERE token = $1
        LIMIT 1
      `,
        [tokenHash],
      );

    const linkRow = result.rows[0];
    if (
      !linkRow ||
      linkRow.revoked_at !== null ||
      linkRow.expires_at === null ||
      linkRow.expires_at.getTime() <= Date.now()
    ) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'Invalid or expired candidate-feedback share link',
      );
    }

    const interview = await this.interviewService.findOne(linkRow.interview_id);
    if (getCandidateFeedbackInterviewStatusBlockReason(interview.status)) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'Candidate feedback is not available for this share link',
        { interviewId: linkRow.interview_id },
      );
    }

    const feedback = await this.candidateFeedbackService.findByInterviewId(
      linkRow.interview_id,
    );

    if (!feedback || !hasAnyPublishableCandidateFeedbackBlock(feedback)) {
      throw apiNotFound(
        ApiErrorCode.FEEDBACK_NOT_FOUND,
        'Candidate feedback is not available for this share link',
        { interviewId: linkRow.interview_id },
      );
    }

    return presentPublicCandidateFeedback(feedback, {
      interviewLocale: interview.interviewLocale,
      position: interview.position,
      expiresAt: linkRow.expires_at,
      overallScore: interview.result?.overallScore,
      interview,
    });
  }

  private assertInterviewReadyForShare(interview: Interview): void {
    const blockReason = getCandidateFeedbackInterviewStatusBlockReason(
      interview.status,
    );
    if (blockReason) {
      throw apiConflict(ApiErrorCode.CONFLICT, blockReason, {
        interviewId: interview.id,
        status: interview.status,
      });
    }
  }

  private mapRow(
    row: CandidateFeedbackShareLinkRow,
  ): CandidateFeedbackShareLink {
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
