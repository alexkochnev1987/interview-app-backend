import { DatabaseError } from 'pg';

import {
  calculateFeedbackShareExpiry,
  CANDIDATE_FEEDBACK_SHARE_LINKS_UNIQUE_CONSTRAINTS,
  FEEDBACK_LINKS_UNIQUE_CONSTRAINTS,
  generateFeedbackShareToken,
  hashFeedbackShareToken,
  isPostgresUniqueViolation,
} from './feedback-share-token';

describe('feedback-share-token', () => {
  it('generates a URL-safe random token and hashes it with SHA-256', () => {
    const token = generateFeedbackShareToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const hash = hashFeedbackShareToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('calculates expiry date correctly given TTL in days', () => {
    const now = Date.now();
    const expiry = calculateFeedbackShareExpiry(7);
    const diffDays = (expiry.getTime() - now) / (24 * 60 * 60 * 1000);
    expect(Math.round(diffDays)).toBe(7);
  });

  describe('isPostgresUniqueViolation', () => {
    it('returns true for 23505 DatabaseError when no constraints are specified', () => {
      const error = new DatabaseError('unique violation', 1, 'error');
      error.code = '23505';
      expect(isPostgresUniqueViolation(error)).toBe(true);
    });

    it('returns false for non-23505 errors or non-DatabaseErrors', () => {
      const error = new DatabaseError('other error', 1, 'error');
      error.code = '23503';
      expect(isPostgresUniqueViolation(error)).toBe(false);
      expect(isPostgresUniqueViolation(new Error('general error'))).toBe(false);
      expect(isPostgresUniqueViolation(null)).toBe(false);
    });

    it('validates allowed constraint names', () => {
      const error = new DatabaseError('unique violation', 1, 'error');
      error.code = '23505';
      error.constraint = 'feedback_links_active_per_interview_idx';

      expect(
        isPostgresUniqueViolation(error, FEEDBACK_LINKS_UNIQUE_CONSTRAINTS),
      ).toBe(true);

      expect(
        isPostgresUniqueViolation(
          error,
          CANDIDATE_FEEDBACK_SHARE_LINKS_UNIQUE_CONSTRAINTS,
        ),
      ).toBe(false);
    });
  });
});
