import {
  ALL_PERMISSIONS,
  getPermissions,
  hasPermission,
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
});
