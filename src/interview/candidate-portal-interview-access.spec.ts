import {
  CANDIDATE_PORTAL_ACCESS_DENIED_MESSAGE,
  CANDIDATE_PORTAL_ROLE_DENIED_MESSAGE,
  getCandidatePortalAccessDenialReason,
  getCandidatePortalRoleDenialReason,
  matchesCandidateEmail,
  normalizeCandidateEmail,
} from './candidate-portal-interview-access';

describe('normalizeCandidateEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeCandidateEmail('  Foo@Example.com  ')).toBe(
      'foo@example.com',
    );
  });

  it('treats null/undefined as empty string', () => {
    expect(normalizeCandidateEmail(undefined)).toBe('');
    expect(normalizeCandidateEmail(null)).toBe('');
  });
});

describe('matchesCandidateEmail', () => {
  it('matches case-insensitively after trimming', () => {
    expect(
      matchesCandidateEmail(
        { candidateEmail: 'Foo@Example.com' },
        ' foo@example.com ',
      ),
    ).toBe(true);
  });

  it('rejects when the interview has no candidateEmail', () => {
    expect(matchesCandidateEmail({}, 'foo@example.com')).toBe(false);
  });

  it('rejects when the actor email is blank', () => {
    expect(
      matchesCandidateEmail({ candidateEmail: 'foo@example.com' }, ''),
    ).toBe(false);
    expect(
      matchesCandidateEmail({ candidateEmail: 'foo@example.com' }, undefined),
    ).toBe(false);
  });

  it('rejects a different email', () => {
    expect(
      matchesCandidateEmail(
        { candidateEmail: 'foo@example.com' },
        'bar@example.com',
      ),
    ).toBe(false);
  });
});

describe('getCandidatePortalRoleDenialReason', () => {
  it('allows only the candidate role', () => {
    expect(getCandidatePortalRoleDenialReason('candidate')).toBeNull();
    for (const role of ['super_admin', 'admin', 'hr'] as const) {
      expect(getCandidatePortalRoleDenialReason(role)).toBe(
        CANDIDATE_PORTAL_ROLE_DENIED_MESSAGE,
      );
    }
  });
});

describe('getCandidatePortalAccessDenialReason', () => {
  const actor = { role: 'candidate' as const, email: 'foo@example.com' };

  it('allows a real interview matching the candidate email', () => {
    expect(
      getCandidatePortalAccessDenialReason(
        { candidateEmail: 'foo@example.com', demo: false },
        actor,
      ),
    ).toBeNull();
  });

  it('denies a non-candidate role regardless of email match', () => {
    expect(
      getCandidatePortalAccessDenialReason(
        { candidateEmail: 'foo@example.com', demo: false },
        { role: 'admin', email: 'foo@example.com' },
      ),
    ).toBe(CANDIDATE_PORTAL_ROLE_DENIED_MESSAGE);
  });

  it('denies a demo interview even when the email matches', () => {
    expect(
      getCandidatePortalAccessDenialReason(
        { candidateEmail: 'foo@example.com', demo: true },
        actor,
      ),
    ).toBe(CANDIDATE_PORTAL_ACCESS_DENIED_MESSAGE);
  });

  it('denies an interview belonging to a different candidate', () => {
    expect(
      getCandidatePortalAccessDenialReason(
        { candidateEmail: 'other@example.com', demo: false },
        actor,
      ),
    ).toBe(CANDIDATE_PORTAL_ACCESS_DENIED_MESSAGE);
  });
});
