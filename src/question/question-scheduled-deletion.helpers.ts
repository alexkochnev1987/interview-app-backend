import { QuestionDeleteBlockingInterview } from './interfaces/question.interface';

export function buildInterviewHref(interviewId: string): string {
  return `/interviews/${interviewId}`;
}

export function mapBlockingInterviews(
  rows: Array<{ id: string; candidate_name: string }>,
): QuestionDeleteBlockingInterview[] {
  return rows.map((row) => ({
    id: row.id,
    candidateName: row.candidate_name,
    href: buildInterviewHref(row.id),
  }));
}

export function buildScheduledDeleteReason(
  blockingInterviews: QuestionDeleteBlockingInterview[],
): string {
  if (blockingInterviews.length === 0) {
    return 'Question is scheduled for deletion when related active interviews finish.';
  }

  const links = blockingInterviews.map((interview) => interview.href).join(', ');
  return `Question is scheduled for deletion when these active interviews finish: ${links}`;
}

export function collectPendingDeletionAttachRejectIds(
  ids: string[],
  isPendingDeletion: (id: string) => boolean,
): string[] {
  return ids.filter((id) => isPendingDeletion(id));
}
