import { demoScopeClause } from '../common/demo-scope';
import { excludeOnboardingStarterClause } from '../common/onboarding-starter';
import { isAssignedHrFilterUnassigned } from './assigned-hr-filter';
import { normalizeCandidateEmail } from './candidate-portal-interview-access';
import { InterviewListFiltersDto } from './dto/query-interviews.dto';
import type { InterviewActor } from './interfaces/interview.interface';

export type InterviewFacetFields = 'position' | 'status';

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function buildInterviewFilterClauses(
  query: InterviewListFiltersDto,
  actor: InterviewActor,
  options: { excludeField?: InterviewFacetFields } = {},
): { whereSql: string; params: unknown[] } {
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  whereClauses.push(demoScopeClause(params, actor.demo === true, 'i.demo'));

  if (actor.role === 'hr') {
    params.push(actor.id);
    whereClauses.push(
      `(i.created_by_id = $${params.length} OR i.assigned_hr_id = $${params.length})`,
    );
  }

  if (actor.onboardingCompletedAt != null) {
    whereClauses.push(excludeOnboardingStarterClause(params));
  }

  if (query.q) {
    params.push(`%${escapeLike(query.q)}%`);
    const i = params.length;
    whereClauses.push(`i.candidate_name ILIKE $${i}`);
  }

  if (query.position && options.excludeField !== 'position') {
    params.push(query.position.toLowerCase());
    whereClauses.push(`lower(i.position) = $${params.length}`);
  }

  if (query.status && options.excludeField !== 'status') {
    params.push(query.status);
    whereClauses.push(`i.status = $${params.length}`);
  }

  if (query.assignedHrId) {
    if (isAssignedHrFilterUnassigned(query.assignedHrId)) {
      whereClauses.push('i.assigned_hr_id IS NULL');
    } else {
      params.push(query.assignedHrId);
      whereClauses.push(`i.assigned_hr_id = $${params.length}`);
    }
  }

  if (query.candidateEmail) {
    params.push(normalizeCandidateEmail(query.candidateEmail));
    whereClauses.push(`lower(trim(i.candidate_email)) = $${params.length}`);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereSql, params };
}
