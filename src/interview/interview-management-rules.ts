import {
  InterviewStatus,
  TERMINAL_INTERVIEW_STATUSES,
} from './interfaces/interview.interface';

export const INTERVIEW_PENDING_ONLY_MESSAGE =
  'Interview can only be modified while status is pending';

export const INTERVIEW_PENDING_ONLY_UPDATE_FIELDS = [
  'candidateName',
  'candidateEmail',
  'position',
  'questionIds',
] as const;

export type InterviewPendingOnlyUpdateField =
  (typeof INTERVIEW_PENDING_ONLY_UPDATE_FIELDS)[number];

export function hasInterviewPendingOnlyFieldUpdates(
  dto: Partial<Record<InterviewPendingOnlyUpdateField, unknown>>,
): boolean {
  return INTERVIEW_PENDING_ONLY_UPDATE_FIELDS.some(
    (field) => dto[field] !== undefined,
  );
}

export function getInterviewPendingOnlyBlockReason(
  status: InterviewStatus,
): string | null {
  return status === 'pending' ? null : INTERVIEW_PENDING_ONLY_MESSAGE;
}

export function getInterviewPendingOnlyBlockReasonForFields(
  status: InterviewStatus,
  hasPendingOnlyFieldUpdates: boolean,
): string | null {
  if (!hasPendingOnlyFieldUpdates) {
    return null;
  }
  return getInterviewPendingOnlyBlockReason(status);
}

export const INTERVIEW_TERMINAL_ONLY_MESSAGE =
  'Interview can only be deleted while status is completed or failed';

export function getInterviewTerminalOnlyBlockReason(
  status: InterviewStatus,
): string | null {
  return isTerminalInterviewStatus(status) ? null : INTERVIEW_TERMINAL_ONLY_MESSAGE;
}

export function isTerminalInterviewStatus(status: InterviewStatus): boolean {
  return (TERMINAL_INTERVIEW_STATUSES as readonly string[]).includes(status);
}

export const INTERVIEW_DEMO_DELETE_BLOCKED_MESSAGE =
  'Demo interviews cannot be deleted';

export function getInterviewDemoDeleteBlockReason(
  interview: { demo: boolean },
): string | null {
  return interview.demo === true
    ? INTERVIEW_DEMO_DELETE_BLOCKED_MESSAGE
    : null;
}
