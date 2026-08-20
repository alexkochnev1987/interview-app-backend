import { createHash, randomBytes } from 'crypto';

import { DatabaseError } from 'pg';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export const FEEDBACK_LINKS_UNIQUE_CONSTRAINTS = [
  'feedback_links_active_per_interview_idx',
  'feedback_links_token_idx',
] as const;

export const CANDIDATE_FEEDBACK_SHARE_LINKS_UNIQUE_CONSTRAINTS = [
  'candidate_feedback_share_links_active_per_interview_idx',
  'candidate_feedback_share_links_token_idx',
] as const;

export function generateFeedbackShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashFeedbackShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function calculateFeedbackShareExpiry(ttlDays: number): Date {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
}

export function isPostgresUniqueViolation(
  error: unknown,
  allowedConstraints?: readonly string[],
): boolean {
  if (
    !(error instanceof DatabaseError) ||
    error.code !== POSTGRES_UNIQUE_VIOLATION
  ) {
    return false;
  }
  if (allowedConstraints && allowedConstraints.length > 0) {
    return (
      typeof error.constraint === 'string' &&
      allowedConstraints.includes(error.constraint)
    );
  }
  return true;
}
