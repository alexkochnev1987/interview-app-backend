import { FacetCount } from '../../interview/interview.service';
import { ACTIVE_INTERVIEW_STATUSES } from '../../interview/interfaces/interview.interface';
import { RecruiterAssistantInterviewActivityDto } from './dto/recruiter-assistant.dto';

export function buildInterviewActivityFromStatusFacets(
  statuses: FacetCount[],
): RecruiterAssistantInterviewActivityDto {
  const count = (status: string): number =>
    statuses.find((entry) => entry.value === status)?.count ?? 0;

  const pending = count('pending');
  const inProgress = count('in_progress');
  const processing = count('processing');
  const completed = count('completed');
  const failed = count('failed');
  const active = ACTIVE_INTERVIEW_STATUSES.reduce(
    (sum, status) => sum + count(status),
    0,
  );

  return {
    pending,
    inProgress,
    processing,
    completed,
    failed,
    active,
    total: pending + inProgress + processing + completed + failed,
  };
}
