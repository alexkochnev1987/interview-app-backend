import { UserRole } from './interfaces/user.interface';
import { canReadUserProfile } from './user-access-rules';

describe('user-access-rules', () => {
  const superAdmin = { id: 'r2d2', role: 'super_admin' as UserRole };
  const superAdmin2 = { id: 'r2d3', role: 'super_admin' as UserRole };
  const admin = { id: 'c3po', role: 'admin' as UserRole };
  const admin2 = { id: 'c3po2', role: 'admin' as UserRole };
  const hr = { id: 'bb8', role: 'hr' as UserRole };
  const hr2 = { id: 'bb4', role: 'hr' as UserRole };
  const candidate1 = { id: 'bb5', role: 'candidate' as UserRole };
  const candidate2 = { id: 'bb7', role: 'candidate' as UserRole };

  it('allows super_admin to access everyone', () => {
    expect(canReadUserProfile(admin, superAdmin)).toBe(true);
    expect(canReadUserProfile(superAdmin2, superAdmin)).toBe(true);
    expect(canReadUserProfile(hr, superAdmin)).toBe(true);
    expect(canReadUserProfile(candidate1, superAdmin)).toBe(true);
  });

  it('admin can access anyone but super_admin', () => {
    expect(canReadUserProfile(admin2, admin)).toBe(true);
    expect(canReadUserProfile(hr, admin)).toBe(true);
    expect(canReadUserProfile(candidate2, admin)).toBe(true);
    expect(canReadUserProfile(superAdmin, admin)).toBe(false);
  });

  it('hr can only access hrs and candidates', () => {
    expect(canReadUserProfile(superAdmin, hr)).toBe(false);
    expect(canReadUserProfile(admin, hr)).toBe(false);
    expect(canReadUserProfile(hr2, hr)).toBe(true);
    expect(canReadUserProfile(candidate2, hr)).toBe(true);
  });

  it('candidate can access only their own profile', () => {
    expect(canReadUserProfile(superAdmin, candidate1)).toBe(false);
    expect(canReadUserProfile(admin, candidate1)).toBe(false);
    expect(canReadUserProfile(hr2, candidate1)).toBe(false);
    expect(canReadUserProfile(candidate2, candidate1)).toBe(false);
    expect(canReadUserProfile(candidate1, candidate1)).toBe(true);
  });

  it('allows any role to read their own profile', () => {
    expect(canReadUserProfile(superAdmin, superAdmin)).toBe(true);
    expect(canReadUserProfile(admin, admin)).toBe(true);
    expect(canReadUserProfile(hr, hr)).toBe(true);
  });
});
