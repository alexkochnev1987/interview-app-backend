import {
  ACTIVE_INTERVIEW_STATUSES,
  InterviewStatus,
} from './interfaces/interview.interface';

const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_INTERVIEW_STATUSES);

export function isActiveInterviewStatus(status: InterviewStatus): boolean {
  return ACTIVE_STATUS_SET.has(status);
}

/**
 * "Most relevant/recent first" for a candidate's own interview list:
 * anything still in progress outranks anything finished, and within each
 * group the most recently updated interview comes first.
 */
export function sortInterviewsByCandidateRelevance<
  T extends { status: InterviewStatus; updatedAt: Date },
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const aActive = isActiveInterviewStatus(a.status);
    const bActive = isActiveInterviewStatus(b.status);
    if (aActive !== bActive) {
      return aActive ? -1 : 1;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}
