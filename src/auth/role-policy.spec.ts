import { ASSIGNABLE_BY, ALL_ROLES, outranks, ROLE_RANK } from './role-policy';

describe('role-policy', () => {
  it('ranks roles from candidate up to super_admin', () => {
    expect(ROLE_RANK.candidate).toBeLessThan(ROLE_RANK.hr);
    expect(ROLE_RANK.hr).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.super_admin);
  });

  it('outranks requires strictly higher rank', () => {
    expect(outranks('super_admin', 'admin')).toBe(true);
    expect(outranks('admin', 'hr')).toBe(true);
    expect(outranks('hr', 'candidate')).toBe(true);
    expect(outranks('admin', 'admin')).toBe(false);
    expect(outranks('hr', 'admin')).toBe(false);
    expect(outranks('candidate', 'hr')).toBe(false);
  });

  it('limits assignable roles per actor', () => {
    expect(ASSIGNABLE_BY.super_admin).toEqual(
      expect.arrayContaining(['super_admin', 'admin', 'hr', 'candidate']),
    );
    expect(ASSIGNABLE_BY.admin).toEqual(['hr', 'candidate']);
    expect(ASSIGNABLE_BY.hr).toEqual([]);
    expect(ASSIGNABLE_BY.candidate).toEqual([]);
  });

  it('covers every role in ALL_ROLES', () => {
    expect(ALL_ROLES).toEqual(
      expect.arrayContaining(['super_admin', 'admin', 'hr', 'candidate']),
    );
  });
});
