import {
  InterviewStatus,
  TERMINAL_INTERVIEW_STATUSES,
} from './interfaces/interview.interface';

export const INTERVIEW_PENDING_ONLY_MESSAGE =
  'Interview can only be modified while status is pending';

export function getInterviewPendingOnlyBlockReason(
  status: InterviewStatus,
): string | null {
  return status === 'pending' ? null : INTERVIEW_PENDING_ONLY_MESSAGE;
}

export function isTerminalInterviewStatus(status: InterviewStatus): boolean {
  return (TERMINAL_INTERVIEW_STATUSES as readonly string[]).includes(status);
}
