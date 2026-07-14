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
