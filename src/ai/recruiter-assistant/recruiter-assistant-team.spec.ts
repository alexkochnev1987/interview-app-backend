import { buildTeamSummaryFromRoleCounts } from './recruiter-assistant-team';

describe('buildTeamSummaryFromRoleCounts', () => {
  it('maps role counts to team summary dto', () => {
    expect(
      buildTeamSummaryFromRoleCounts({
        super_admin: 1,
        admin: 2,
        hr: 3,
        candidate: 4,
      }),
    ).toEqual({
      superAdmin: 1,
      admin: 2,
      hr: 3,
      candidate: 4,
      total: 10,
    });
  });

  it('returns zeros for empty counts', () => {
    expect(
      buildTeamSummaryFromRoleCounts({
        super_admin: 0,
        admin: 0,
        hr: 0,
        candidate: 0,
      }),
    ).toEqual({
      superAdmin: 0,
      admin: 0,
      hr: 0,
      candidate: 0,
      total: 0,
    });
  });
});
