import { InterviewListItem } from '../../interview/interfaces/interview.interface';
import { toInterviewActor } from '../../interview/interview-actor';
import {
  isActiveInterviewStatus,
  sortInterviewsByCandidateRelevance,
} from '../../interview/interview-portal-relevance';
import { InterviewService } from '../../interview/interview.service';
import { ActingUser } from './recruiter-assistant.types';

export type CandidateInterviewResolveResult =
  | { kind: 'found'; interview: InterviewListItem }
  | { kind: 'ambiguous'; interviews: InterviewListItem[] }
  | { kind: 'not_found' };

function normalizePositionText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function positionMatches(
  interviewPosition: string,
  positionQuery: string,
): boolean {
  const normalizedPosition = normalizePositionText(interviewPosition);
  const normalizedQuery = normalizePositionText(positionQuery);
  if (!normalizedQuery) {
    return false;
  }
  return (
    normalizedPosition.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedPosition)
  );
}

/** Every non-demo interview for the authenticated candidate portal actor. */
export async function loadAllCandidateInterviews(
  interviewService: InterviewService,
  user: ActingUser,
): Promise<InterviewListItem[]> {
  return interviewService.findAllForCandidateEmail(
    user.email,
    toInterviewActor(user),
  );
}

/**
 * "Latest" = most relevant first: active interviews outrank finished ones;
 * within each group, most recently updated wins (portal list order).
 */
export function resolveLatestInterview(
  interviews: readonly InterviewListItem[],
): CandidateInterviewResolveResult {
  const sorted = sortInterviewsByCandidateRelevance(interviews);
  const latest = sorted[0];
  if (!latest) {
    return { kind: 'not_found' };
  }
  return { kind: 'found', interview: latest };
}

export function resolveByPosition(
  interviews: readonly InterviewListItem[],
  positionQuery: string,
): CandidateInterviewResolveResult {
  const query = positionQuery.trim();
  if (!query) {
    return resolveLatestInterview(interviews);
  }

  const matches = sortInterviewsByCandidateRelevance(
    interviews.filter((interview) =>
      positionMatches(interview.position, query),
    ),
  );

  if (matches.length === 0) {
    return { kind: 'not_found' };
  }
  if (matches.length === 1) {
    return { kind: 'found', interview: matches[0] };
  }
  return { kind: 'ambiguous', interviews: matches };
}

/** Pending, in-progress, and processing interviews in portal relevance order. */
export function filterActiveInterviews(
  interviews: readonly InterviewListItem[],
): InterviewListItem[] {
  return sortInterviewsByCandidateRelevance(
    interviews.filter((interview) => isActiveInterviewStatus(interview.status)),
  );
}
