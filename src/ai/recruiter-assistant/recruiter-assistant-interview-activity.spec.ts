import { buildInterviewActivityFromStatusFacets } from './recruiter-assistant-interview-activity';

describe('buildInterviewActivityFromStatusFacets', () => {
  it('returns zeros for empty facets', () => {
    expect(buildInterviewActivityFromStatusFacets([])).toEqual({
      pending: 0,
      inProgress: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      active: 0,
      total: 0,
    });
  });

  it('maps status counts and active total', () => {
    expect(
      buildInterviewActivityFromStatusFacets([
        { value: 'pending', count: 2 },
        { value: 'in_progress', count: 1 },
        { value: 'processing', count: 1 },
        { value: 'completed', count: 5 },
        { value: 'failed', count: 1 },
      ]),
    ).toEqual({
      pending: 2,
      inProgress: 1,
      processing: 1,
      completed: 5,
      failed: 1,
      active: 4,
      total: 10,
    });
  });
});
