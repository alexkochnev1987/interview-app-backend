import { createHash, randomBytes } from 'crypto';

import { DatabaseError } from 'pg';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export function generateFeedbackShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashFeedbackShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function calculateFeedbackShareExpiry(ttlDays: number): Date {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    error instanceof DatabaseError && error.code === POSTGRES_UNIQUE_VIOLATION
  );
}
