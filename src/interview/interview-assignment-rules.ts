import { apiForbidden } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { InterviewActor } from './interfaces/interview.interface';

export const HR_ASSIGNMENT_FORBIDDEN_MESSAGE =
  'Only admins can assign HR reviewers';

export function assertActorCanSetAssignedHr(
  actor: InterviewActor,
  assignedHrId: string | null | undefined,
): void {
  if (assignedHrId === undefined) {
    return;
  }
  if (actor.role !== 'super_admin' && actor.role !== 'admin') {
    throw apiForbidden(ApiErrorCode.FORBIDDEN, HR_ASSIGNMENT_FORBIDDEN_MESSAGE);
  }
}
