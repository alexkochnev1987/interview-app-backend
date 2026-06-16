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

// Permissions a read-only demo account keeps; every other permission is denied.
// Intentionally excludes users:read — the demo never lists accounts, and leaving
// it out keeps demo safe regardless of the underlying role.
export const READ_ONLY_PERMISSIONS: readonly Permission[] = [
  'questions:read',
  'interviews:read_own',
];

export function isReadOnlyPermission(permission: Permission): boolean {
  return READ_ONLY_PERMISSIONS.includes(permission);
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// Like hasPermission, but a demo user is denied any non-read permission.
export function hasEffectivePermission(
  role: UserRole,
  demo: boolean,
  permission: Permission,
): boolean {
  if (demo && !isReadOnlyPermission(permission)) {
    return false;
  }
  return hasPermission(role, permission);
}

export function getPermissions(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

// Permissions reported to the client; demo users get the read-only subset.
export function getEffectivePermissions(
  role: UserRole,
  demo: boolean,
): Permission[] {
  const base = ROLE_PERMISSIONS[role];
  if (!demo) {
    return [...base];
  }
  return base.filter(isReadOnlyPermission);
}
