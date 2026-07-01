import { demoScopeClause } from '../common/demo-scope';
import { QueryInterviewsDto } from './dto/query-interviews.dto';
import type { InterviewActor } from './interfaces/interview.interface';

export type InterviewFacetFields = 'position' | 'status';

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function buildInterviewFilterClauses(
  query: QueryInterviewsDto,
  actor: InterviewActor,
  options: { excludeField?: InterviewFacetFields } = {},
): { whereSql: string; params: unknown[] } {
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  whereClauses.push(demoScopeClause(params, actor.demo === true));

  if (actor.role === 'hr') {
    params.push(actor.id);
    whereClauses.push(`created_by_id = $${params.length}`);
  }

  if (query.q) {
    params.push(`%${escapeLike(query.q)}%`);
    const i = params.length;
    whereClauses.push(`candidate_name ILIKE $${i}`);
  }

  if (query.position && options.excludeField !== 'position') {
    params.push(query.position.toLowerCase());
    whereClauses.push(`lower(position) = $${params.length}`);
  }

  if (query.status && options.excludeField !== 'status') {
    params.push(query.status);
    whereClauses.push(`status = $${params.length}`);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereSql, params };
}
