import { UserRole } from '../user/interfaces/user.interface';

/**
 * Hierarchy used to enforce "actor must outrank target" in role-mutation flows.
 * Higher number = more authority.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  hr: 2,
  candidate: 1,
};

/**
 * Whitelist of roles each actor may grant. Empty list = actor cannot assign at all.
 * Note: rank check (`outranks`) is enforced separately, so admins still cannot
 * promote anyone to super_admin even though `super_admin` would otherwise pass
 * an `IsIn(allRoles)` validator.
 */
export const ASSIGNABLE_BY: Record<UserRole, UserRole[]> = {
  super_admin: ['super_admin', 'admin', 'hr', 'candidate'],
  admin: ['hr', 'candidate'],
  hr: [],
  candidate: [],
};

export const ALL_ROLES: readonly UserRole[] = Object.keys(ROLE_RANK) as UserRole[];

export function outranks(actor: UserRole, target: UserRole): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}
