import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { RecruiterAssistantPendingActionDto } from './dto/recruiter-assistant.dto';

const PENDING_ACTION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class RecruiterPendingActionStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async issue(
    userId: string,
    action: RecruiterAssistantPendingActionDto,
  ): Promise<string> {
    await this.pruneExpired();
    const id = randomUUID();
    await this.databaseService.query(
      `
        INSERT INTO recruiter_pending_actions (id, user_id, action_json, expires_at)
        VALUES ($1, $2, $3::jsonb, $4)
      `,
      [
        id,
        userId,
        JSON.stringify(action),
        new Date(Date.now() + PENDING_ACTION_TTL_MS),
      ],
    );
    return id;
  }

  async consume(
    userId: string,
    pendingActionId: string,
  ): Promise<RecruiterAssistantPendingActionDto | null> {
    const result = await this.databaseService.query<{
      action_json: RecruiterAssistantPendingActionDto;
    }>(
      `
        DELETE FROM recruiter_pending_actions
        WHERE id = $1
          AND user_id = $2
          AND expires_at > NOW()
        RETURNING action_json
      `,
      [pendingActionId, userId],
    );

    return result.rows[0]?.action_json ?? null;
  }

  async revoke(userId: string, pendingActionId: string): Promise<boolean> {
    const result = await this.databaseService.query<{ id: string }>(
      `
        DELETE FROM recruiter_pending_actions
        WHERE id = $1
          AND user_id = $2
        RETURNING id
      `,
      [pendingActionId, userId],
    );

    return result.rows.length > 0;
  }

  private async pruneExpired(): Promise<void> {
    await this.databaseService.query(
      `
        DELETE FROM recruiter_pending_actions
        WHERE expires_at <= NOW()
      `,
    );
  }
}
