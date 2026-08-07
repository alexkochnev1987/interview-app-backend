import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RecruiterConversationState } from './recruiter-conversation.types';
import { idleConversationState } from './recruiter-conversation-slots';

const CONVERSATION_TTL_MS = 15 * 60 * 1000;

interface StoredConversation {
  userId: string;
  state: RecruiterConversationState;
  expiresAt: number;
}

@Injectable()
export class RecruiterConversationStore {
  private readonly entries = new Map<string, StoredConversation>();

  issue(userId: string): string {
    this.pruneExpired();
    const id = randomUUID();
    this.entries.set(id, {
      userId,
      state: idleConversationState(),
      expiresAt: Date.now() + CONVERSATION_TTL_MS,
    });
    return id;
  }

  get(userId: string, sessionId: string): RecruiterConversationState | null {
    this.pruneExpired();
    const entry = this.entries.get(sessionId);
    if (!entry || entry.userId !== userId || entry.expiresAt <= Date.now()) {
      return null;
    }
    entry.expiresAt = Date.now() + CONVERSATION_TTL_MS;
    return entry.state;
  }

  update(
    userId: string,
    sessionId: string,
    state: RecruiterConversationState,
  ): boolean {
    this.pruneExpired();
    const entry = this.entries.get(sessionId);
    if (!entry || entry.userId !== userId || entry.expiresAt <= Date.now()) {
      return false;
    }
    entry.state = state;
    entry.expiresAt = Date.now() + CONVERSATION_TTL_MS;
    return true;
  }

  clear(userId: string, sessionId: string): boolean {
    this.pruneExpired();
    const entry = this.entries.get(sessionId);
    if (!entry || entry.userId !== userId) {
      return false;
    }
    this.entries.delete(sessionId);
    return true;
  }

  clearAllForUser(userId: string): void {
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
