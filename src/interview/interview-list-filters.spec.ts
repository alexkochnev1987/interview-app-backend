import type { InterviewActor } from './interfaces/interview.interface';
import { buildInterviewFilterClauses } from './interview-list-filters';

describe('buildInterviewFilterClauses', () => {
  const adminActor: InterviewActor = { id: 'admin-id', role: 'admin', demo: false };
  const hrActor: InterviewActor = { id: 'hr-id', role: 'hr', demo: false };

  it('scopes HR actors to their own interviews', () => {
    const { whereSql, params } = buildInterviewFilterClauses({}, hrActor);

    expect(whereSql).toBe('WHERE demo = $1 AND created_by_id = $2');
    expect(params).toEqual([false, 'hr-id']);
  });

  it('does not scope admin actors to created_by_id', () => {
    const { whereSql, params } = buildInterviewFilterClauses({}, adminActor);

    expect(whereSql).toBe('WHERE demo = $1');
    expect(params).toEqual([false]);
  });

  it('filters candidate name with ILIKE when q is set', () => {
    const { whereSql, params } = buildInterviewFilterClauses(
      { q: 'alice' },
      adminActor,
    );

    expect(whereSql).toContain('candidate_name ILIKE $2');
    expect(params).toEqual([false, '%alice%']);
  });

  it('escapes LIKE wildcards in q', () => {
    const { params } = buildInterviewFilterClauses({ q: '100%' }, adminActor);

    expect(params[1]).toBe('%100\\%%');
  });

  it('filters position case-insensitively', () => {
    const { whereSql, params } = buildInterviewFilterClauses(
      { position: 'Engineer' },
      adminActor,
    );

    expect(whereSql).toContain('lower(position) = $2');
    expect(params).toEqual([false, 'engineer']);
  });

  it('filters by status', () => {
    const { whereSql, params } = buildInterviewFilterClauses(
      { status: 'completed' },
      adminActor,
    );

    expect(whereSql).toContain('status = $2');
    expect(params).toEqual([false, 'completed']);
  });

  it('excludes position when computing the position facet', () => {
    const { whereSql } = buildInterviewFilterClauses(
      { position: 'Engineer', status: 'pending' },
      adminActor,
      { excludeField: 'position' },
    );

    expect(whereSql).not.toContain('lower(position)');
    expect(whereSql).toContain('status = $2');
  });

  it('excludes status when computing the status facet', () => {
    const { whereSql } = buildInterviewFilterClauses(
      { position: 'Engineer', status: 'pending' },
      adminActor,
      { excludeField: 'status' },
    );

    expect(whereSql).toContain('lower(position) = $2');
    expect(whereSql).not.toMatch(/status =/);
  });
});
