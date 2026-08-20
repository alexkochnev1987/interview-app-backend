import { UserRole } from '../user/interfaces/user.interface';

export const CANDIDATE_PORTAL_ROLE_DENIED_MESSAGE =
  'You do not have access to interviews';
export const CANDIDATE_PORTAL_ACCESS_DENIED_MESSAGE =
  'You do not have access to this interview';

export interface CandidatePortalActor {
  role: UserRole;
  email?: string;
}

export function normalizeCandidateEmail(
  email: string | null | undefined,
): string {
  return (email ?? '').trim().toLowerCase();
}

export function matchesCandidateEmail(
  interview: { candidateEmail?: string },
  actorEmail: string | null | undefined,
): boolean {
  const normalizedActor = normalizeCandidateEmail(actorEmail);
  if (!normalizedActor) {
    return false;
  }
  return normalizeCandidateEmail(interview.candidateEmail) === normalizedActor;
}

/** Coarse gate: only the candidate role may use the portal at all. */
export function getCandidatePortalRoleDenialReason(
  actorRole: UserRole,
): string | null {
  return actorRole === 'candidate'
    ? null
    : CANDIDATE_PORTAL_ROLE_DENIED_MESSAGE;
}

/** Per-interview gate: real (non-demo) interview owned by this candidate's email. */
export function getCandidatePortalAccessDenialReason(
  interview: { candidateEmail?: string; demo: boolean },
  actor: CandidatePortalActor,
): string | null {
  const roleDenial = getCandidatePortalRoleDenialReason(actor.role);
  if (roleDenial) {
    return roleDenial;
  }
  if (interview.demo) {
    return CANDIDATE_PORTAL_ACCESS_DENIED_MESSAGE;
  }
  if (!matchesCandidateEmail(interview, actor.email)) {
    return CANDIDATE_PORTAL_ACCESS_DENIED_MESSAGE;
  }
  return null;
}
