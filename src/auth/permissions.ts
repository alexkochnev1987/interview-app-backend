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
// Intentionally excludes users:read (see EXCLUDED_FROM_DEMO_READ below).
export const READ_ONLY_PERMISSIONS: readonly Permission[] = [
  'questions:read',
  'interviews:read_own',
];

// Read-style permissions deliberately withheld from demo accounts. Every
// read-style permission must appear in either READ_ONLY_PERMISSIONS or this set
// (the spec enforces it, preventing silent mis-classification).
//   users:read — the demo never lists accounts; excluding it keeps the demo safe
//   regardless of role (even a demo admin cannot read users).
export const EXCLUDED_FROM_DEMO_READ: readonly Permission[] = ['users:read'];

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
