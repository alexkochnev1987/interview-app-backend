import { UserRole } from '../user/interfaces/user.interface';

export const INTERVIEW_ACCESS_DENIED_MESSAGE =
  'You do not have access to this interview';

export interface InterviewAccessActor {
  id: string;
  role: UserRole;
}

export function getInterviewAccessDenialReason(
  interview: { createdById?: string },
  actor: InterviewAccessActor,
): string | null {
  if (actor.role === 'super_admin' || actor.role === 'admin') {
    return null;
  }
  if (actor.role === 'hr' && interview.createdById === actor.id) {
    return null;
  }
  return INTERVIEW_ACCESS_DENIED_MESSAGE;
}
