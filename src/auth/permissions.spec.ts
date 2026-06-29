import {
  ALL_PERMISSIONS,
  EXCLUDED_FROM_DEMO_READ,
  getEffectivePermissions,
  getPermissions,
  hasEffectivePermission,
  hasPermission,
  READ_ONLY_PERMISSIONS,
} from './permissions';

describe('permissions', () => {
  it('grants super_admin every permission', () => {
    expect(getPermissions('super_admin')).toEqual(
      expect.arrayContaining([...ALL_PERMISSIONS]),
    );
    expect(getPermissions('super_admin')).toHaveLength(ALL_PERMISSIONS.length);
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission('super_admin', permission)).toBe(true);
    }
  });

  it('allows admin to mutate questions but not delete them', () => {
    expect(hasPermission('admin', 'questions:create')).toBe(true);
    expect(hasPermission('admin', 'questions:update')).toBe(true);
    expect(hasPermission('admin', 'questions:delete')).toBe(false);
  });

  it('allows HR to read questions and manage interviews without question mutation', () => {
    expect(hasPermission('hr', 'questions:read')).toBe(true);
    expect(hasPermission('hr', 'interviews:create')).toBe(true);
    expect(hasPermission('hr', 'questions:create')).toBe(false);
    expect(hasPermission('hr', 'questions:delete')).toBe(false);
    expect(hasPermission('hr', 'users:assign_role')).toBe(false);
  });

  it('grants candidate no staff permissions', () => {
    expect(getPermissions('candidate')).toEqual([]);
    expect(hasPermission('candidate', 'questions:read')).toBe(false);
  });

  describe('demo read-only mode', () => {
    it('keeps HR read permissions but strips every write for a demo user', () => {
      const effective = getEffectivePermissions('hr', true);
      expect(effective).toEqual(
        expect.arrayContaining(['questions:read', 'interviews:read_own']),
      );
      expect(effective).not.toContain('interviews:create');
      expect(effective).not.toContain('interviews:update_own');
      expect(effective).not.toContain('interviews:assign');
      expect(effective).not.toContain('feedback:create_share_link');
      expect(effective.every((p) => READ_ONLY_PERMISSIONS.includes(p))).toBe(true);
    });

    it('does not change permissions for a non-demo user', () => {
      expect(getEffectivePermissions('hr', false)).toEqual(getPermissions('hr'));
    });

    it('denies a demo user any write permission their role would otherwise grant', () => {
      expect(hasEffectivePermission('hr', true, 'questions:read')).toBe(true);
      expect(hasEffectivePermission('hr', true, 'interviews:read_own')).toBe(true);
      expect(hasEffectivePermission('hr', true, 'interviews:create')).toBe(false);
      expect(hasEffectivePermission('hr', true, 'interviews:update_own')).toBe(false);
    });

    it('still requires the underlying role permission even in read-only mode', () => {
      expect(hasEffectivePermission('candidate', true, 'questions:read')).toBe(false);
      expect(hasEffectivePermission('admin', true, 'questions:read')).toBe(true);
      expect(hasEffectivePermission('admin', true, 'users:assign_role')).toBe(false);
    });

    it('classifies every read-style permission as either demo-read-only or explicitly excluded', () => {
      const readStyle = ALL_PERMISSIONS.filter(
        (p) => p.endsWith(':read') || p.endsWith(':read_own'),
      );
      for (const permission of readStyle) {
        const inAllowlist = READ_ONLY_PERMISSIONS.includes(permission);
        const inExcluded = EXCLUDED_FROM_DEMO_READ.includes(permission);
        expect(inAllowlist || inExcluded).toBe(true);
        expect(inAllowlist && inExcluded).toBe(false);
      }
    });

    it('does not list any non-existent or non-read permission in the demo classification sets', () => {
      for (const permission of [
        ...READ_ONLY_PERMISSIONS,
        ...EXCLUDED_FROM_DEMO_READ,
      ]) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
      for (const permission of EXCLUDED_FROM_DEMO_READ) {
        expect(
          permission.endsWith(':read') || permission.endsWith(':read_own'),
        ).toBe(true);
      }
    });

    it('denies users:read to a demo account regardless of role', () => {
      expect(hasEffectivePermission('admin', true, 'users:read')).toBe(false);
      expect(hasEffectivePermission('super_admin', true, 'users:read')).toBe(false);
    });
  });
});
