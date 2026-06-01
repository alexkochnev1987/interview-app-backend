import { ALL_PERMISSIONS, getPermissions, hasPermission } from './permissions';

describe('permissions', () => {
  it('maps staff and candidate roles to expected access', () => {
    expect(getPermissions('super_admin')).toEqual([...ALL_PERMISSIONS]);
    expect(hasPermission('admin', 'questions:delete')).toBe(false);
    expect(hasPermission('admin', 'questions:create')).toBe(true);
    expect(hasPermission('hr', 'questions:read')).toBe(true);
    expect(hasPermission('hr', 'questions:create')).toBe(false);
    expect(getPermissions('candidate')).toEqual([]);
  });
});
