import { UserRole } from '../../user/interfaces/user.interface';

const ROLE_ALIASES: Array<[RegExp, UserRole]> = [
  [/\bsuper[_\s-]?admins?\b/i, 'super_admin'],
  [/\bhr reviewers?\b/i, 'hr'],
  [/\bhrs?\b/i, 'hr'],
  [/\badmins?\b/i, 'admin'],
  [/\bcandidates?\b/i, 'candidate'],
];

const ROLE_AFTER_WITH =
  /\b(?:with|having)\b[^.?!]*\brole\b[^.?!]*\b(\w[\w\s_-]*)\b/i;
const ROLE_BEFORE_ROLE =
  /\brole\b[^.?!]*\b(super[_\s-]?admin|admin|hr|candidate)s?\b/i;

function normalizeRoleToken(token: string): UserRole | undefined {
  const normalized = token
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized.includes('super') && normalized.includes('admin')) {
    return 'super_admin';
  }
  if (normalized === 'admin' || normalized === 'admins') {
    return 'admin';
  }
  if (normalized === 'hr' || normalized === 'hrs') {
    return 'hr';
  }
  if (normalized === 'candidate' || normalized === 'candidates') {
    return 'candidate';
  }
  return undefined;
}

export function extractTeamRoleFilter(message: string): UserRole | undefined {
  const roleAfterWith = message.match(ROLE_AFTER_WITH)?.[1];
  if (roleAfterWith) {
    const role = normalizeRoleToken(roleAfterWith);
    if (role) {
      return role;
    }
  }

  const roleBeforeRole = message.match(ROLE_BEFORE_ROLE)?.[1];
  if (roleBeforeRole) {
    const role = normalizeRoleToken(roleBeforeRole);
    if (role) {
      return role;
    }
  }

  for (const [pattern, role] of ROLE_ALIASES) {
    if (pattern.test(message)) {
      return role;
    }
  }

  return undefined;
}
