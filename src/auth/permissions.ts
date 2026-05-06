import { UserRole } from '../user/interfaces/user.interface';

export const ALL_PERMISSIONS = [
  'users:read',
  'users:assign_role',
  'questions:create',
  'questions:read',
  'questions:update',
  'questions:delete',
  'interviews:create',
  'interviews:read_own',
  'interviews:update_own',
  'interviews:assign',
  'feedback:create_share_link',
  'feedback:revoke_share_link',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: [
    'users:read',
    'users:assign_role',
    'questions:create',
    'questions:read',
    'questions:update',
    'interviews:create',
    'interviews:read_own',
    'interviews:update_own',
    'interviews:assign',
    'feedback:create_share_link',
    'feedback:revoke_share_link',
  ],
  hr: [
    'questions:read',
    'interviews:create',
    'interviews:read_own',
    'interviews:update_own',
    'interviews:assign',
    'feedback:create_share_link',
    'feedback:revoke_share_link',
  ],
  candidate: [],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissions(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
