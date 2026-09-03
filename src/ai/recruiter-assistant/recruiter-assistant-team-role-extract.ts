import { UserRole } from '../../user/interfaces/user.interface';

const ROLE_ALIASES: Array<[RegExp, UserRole]> = [
  [/\bsuper[_\s-]?admins?\b/i, 'super_admin'],
  [/\bsuper[_\s-]?(?:админ|адмін)s?\b/iu, 'super_admin'],
  [/\bhr reviewers?\b/i, 'hr'],
  [/\bhrs?\b/i, 'hr'],
  [/\badmins?\b/i, 'admin'],
  [/\badmin(?:ów|ami|y|a|s)?\b/i, 'admin'],
  [/\b(?:админ|адмін)(?:ы|ов|ów|ам|ami|y|a|s)?\b/iu, 'admin'],
  [/(?:админ|адмін)(?:ы|ов|ów|ам|ami|y|a|s)?/iu, 'admin'],
  [/\bcandidates?\b/i, 'candidate'],
  [/\b(?:кандидат|kandydat)(?:ы|ов|ów|ami|y)?\b/iu, 'candidate'],
];

const ROLE_AFTER_WITH =
  /\b(?:with|having|с|маючы|z|mając)\b[^.?!]*\b(?:role|роль|rol[ęe])\b[^.?!]*\b(\w[\w\s_-]*)\b/iu;
const ROLE_BEFORE_ROLE =
  /\b(?:role|роль|rola)\b[^.?!]*\b(super[_\s-]?admin|admin|hr|candidate|админ|адмін|кандидат|kandydat)s?\b/iu;

function normalizeRoleToken(token: string): UserRole | undefined {
  const normalized = token
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized.includes('super') && normalized.includes('admin')) {
    return 'super_admin';
  }
  if (
    normalized === 'admin' ||
    normalized === 'admins' ||
    normalized === 'админ' ||
    normalized === 'админы' ||
    normalized === 'админов' ||
    normalized === 'адмін' ||
    normalized === 'адміны' ||
    normalized === 'адмінаў' ||
    normalized === 'adminów' ||
    normalized === 'adminow'
  ) {
    return 'admin';
  }
  if (normalized === 'hr' || normalized === 'hrs') {
    return 'hr';
  }
  if (
    normalized === 'candidate' ||
    normalized === 'candidates' ||
    normalized === 'кандидат' ||
    normalized === 'кандидаты' ||
    normalized === 'kandydat' ||
    normalized === 'kandydaci' ||
    normalized === 'kandydatów'
  ) {
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
