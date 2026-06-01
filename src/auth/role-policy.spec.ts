import { ASSIGNABLE_BY, outranks } from './role-policy';

describe('role-policy', () => {
  it('outranks only when actor rank is higher', () => {
    expect(outranks('super_admin', 'admin')).toBe(true);
    expect(outranks('admin', 'admin')).toBe(false);
    expect(outranks('candidate', 'hr')).toBe(false);
  });

  it('whitelists assignable roles per actor', () => {
    expect(ASSIGNABLE_BY.super_admin).toEqual([
      'super_admin',
      'admin',
      'hr',
      'candidate',
    ]);
    expect(ASSIGNABLE_BY.admin).toEqual(['hr', 'candidate']);
    expect(ASSIGNABLE_BY.hr).toEqual([]);
    expect(ASSIGNABLE_BY.candidate).toEqual([]);
  });
});
