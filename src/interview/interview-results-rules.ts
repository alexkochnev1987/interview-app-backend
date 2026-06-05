import type { Interview } from './interfaces/interview.interface';

export function getInterviewResultsUnavailableMessage(
  interview: Pick<Interview, 'status' | 'result'>,
  interviewId: string,
): string | null {
  if (interview.status !== 'completed' || !interview.result) {
    return `Results for interview "${interviewId}" are not available yet (status: ${interview.status})`;
  }
  return null;
}
