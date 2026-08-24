import { extractTeamRoleFilter } from './recruiter-assistant-team-role-extract';

describe('extractTeamRoleFilter', () => {
  it('returns undefined for generic team requests', () => {
    expect(extractTeamRoleFilter('show my team')).toBeUndefined();
    expect(extractTeamRoleFilter('list team members')).toBeUndefined();
  });

  it('extracts hr role', () => {
    expect(extractTeamRoleFilter('show all hrs')).toBe('hr');
    expect(extractTeamRoleFilter('list hr reviewers')).toBe('hr');
  });

  it('extracts admin role', () => {
    expect(extractTeamRoleFilter('list all admins')).toBe('admin');
    expect(extractTeamRoleFilter('team members with admin role')).toBe('admin');
  });

  it('extracts super_admin role', () => {
    expect(extractTeamRoleFilter('show super admins')).toBe('super_admin');
  });

  it('extracts candidate role', () => {
    expect(extractTeamRoleFilter('show all candidates')).toBe('candidate');
  });
});
