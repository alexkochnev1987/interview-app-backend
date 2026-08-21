import { buildCandidatePortalFilterClauses } from './candidate-portal-interview-filters';

describe('buildCandidatePortalFilterClauses', () => {
  it('filters by normalized candidate email, excludes demo rows and onboarding-starter samples', () => {
    const { whereSql, params } = buildCandidatePortalFilterClauses(
      '  Foo@Example.com  ',
    );

    expect(whereSql).toContain('lower(trim(i.candidate_email)) = $1');
    expect(whereSql).toContain('i.demo = FALSE');
    expect(whereSql).toContain('i.candidate_email NOT LIKE $2');
    expect(params[0]).toBe('foo@example.com');
    expect(params[1]).toBe('%@onboarding-starter.sample');
  });
});
