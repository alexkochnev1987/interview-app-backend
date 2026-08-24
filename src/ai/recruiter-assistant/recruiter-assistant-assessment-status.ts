import { InterviewListItem } from '../../interview/interfaces/interview.interface';

export const ASSESSMENT_REVIEW_STATUS_VALUES = [
  'ready_to_score',
  'ready',
  'scoring',
  'failed',
] as const;

export type AssessmentReviewStatus =
  (typeof ASSESSMENT_REVIEW_STATUS_VALUES)[number];

export type AssessmentReviewStatusFilter = AssessmentReviewStatus | 'all';

const HR_VISIBLE_REVIEW_STATUSES = new Set<AssessmentReviewStatus>([
  'ready_to_score',
  'scoring',
  'ready',
  'failed',
]);

/** Mirrors frontend deriveReviewStatusFromListItem for /assessments list cards. */
export function deriveReviewStatusFromListItem(
  item: InterviewListItem,
): AssessmentReviewStatus | 'pending' | 'in_progress' | 'canceled' {
  switch (item.status) {
    case 'failed':
      return 'failed';
    case 'pending':
      return 'pending';
    case 'in_progress':
      if (
        item.questionCount > 0 &&
        item.submittedAnswerCount === item.questionCount
      ) {
        return 'ready_to_score';
      }
      return 'in_progress';
    case 'processing':
      if (item.overallScore !== undefined) {
        return 'ready';
      }
      return 'scoring';
    case 'completed':
      return item.overallScore !== undefined ? 'ready' : 'scoring';
    default:
      return 'pending';
  }
}

export function isHrVisibleAssessmentListItem(
  item: InterviewListItem,
): boolean {
  const status = deriveReviewStatusFromListItem(item);
  return HR_VISIBLE_REVIEW_STATUSES.has(status as AssessmentReviewStatus);
}

export function selectHrVisibleAssessmentListItems(
  items: InterviewListItem[],
): InterviewListItem[] {
  return items.filter(isHrVisibleAssessmentListItem);
}

export function matchesAssessmentQuery(
  item: InterviewListItem,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const haystack = `${item.candidateName} ${item.position}`.toLowerCase();
  return haystack.includes(normalized);
}

export function filterAssessmentsByReviewStatus(
  items: InterviewListItem[],
  status: AssessmentReviewStatusFilter | undefined,
): InterviewListItem[] {
  if (!status || status === 'all') {
    return items;
  }
  return items.filter(
    (item) => deriveReviewStatusFromListItem(item) === status,
  );
}
