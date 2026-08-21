import { excludeOnboardingStarterClause } from '../common/onboarding-starter';
import { normalizeCandidateEmail } from './candidate-portal-interview-access';

/**
 * WHERE builder for the candidate-portal interview list: real (non-demo)
 * interviews whose candidate_email matches the authenticated candidate,
 * normalized the same way `normalizeCandidateEmail` does in TS.
 */
export function buildCandidatePortalFilterClauses(candidateEmail: string): {
  whereSql: string;
  params: unknown[];
} {
  const params: unknown[] = [normalizeCandidateEmail(candidateEmail)];
  const whereClauses = [
    `lower(trim(i.candidate_email)) = $${params.length}`,
    'i.demo = FALSE',
    excludeOnboardingStarterClause(params, 'i.candidate_email'),
  ];

  return { whereSql: `WHERE ${whereClauses.join(' AND ')}`, params };
}
