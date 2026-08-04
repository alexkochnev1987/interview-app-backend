import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RecruiterAssistantPendingActionDto } from './dto/recruiter-assistant.dto';

const PENDING_ACTION_TTL_MS = 15 * 60 * 1000;

interface StoredPendingAction {
  userId: string;
  action: RecruiterAssistantPendingActionDto;
  expiresAt: number;
}

@Injectable()
export class RecruiterPendingActionStore {
  private readonly entries = new Map<string, StoredPendingAction>();

  issue(
    userId: string,
    action: RecruiterAssistantPendingActionDto,
  ): string {
    this.pruneExpired();
    const id = randomUUID();
    this.entries.set(id, {
      userId,
      action,
      expiresAt: Date.now() + PENDING_ACTION_TTL_MS,
    });
    return id;
  }

  consume(userId: string, pendingActionId: string): RecruiterAssistantPendingActionDto | null {
    this.pruneExpired();
    const entry = this.entries.get(pendingActionId);
    if (!entry || entry.userId !== userId || entry.expiresAt <= Date.now()) {
      return null;
    }

    this.entries.delete(pendingActionId);
    return entry.action;
  }

  revoke(userId: string, pendingActionId: string): boolean {
    this.pruneExpired();
    const entry = this.entries.get(pendingActionId);
    if (!entry || entry.userId !== userId) {
      return false;
    }

    this.entries.delete(pendingActionId);
    return true;
  }

  revokeAllForUser(userId: string): void {
    this.pruneExpired();
    for (const [id, entry] of this.entries) {
      if (entry.userId === userId) {
        this.entries.delete(id);
      }
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(id);
      }
    }
  }
}
