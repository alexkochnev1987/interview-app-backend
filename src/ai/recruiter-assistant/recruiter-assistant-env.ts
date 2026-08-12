import { UserRole } from '../../user/interfaces/user.interface';

const CHAT_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'hr',
  'candidate',
];

function trimEnv(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseBooleanEnv(
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  if (!raw) return defaultValue;
  const lower = raw.toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(lower)) return false;
  if (['1', 'true', 'yes', 'on'].includes(lower)) return true;
  return defaultValue;
}

/** Default: enabled when unset (backward compatible). */
export function isRecruiterAssistantEnabled(): boolean {
  return parseBooleanEnv(trimEnv('RECRUITER_ASSISTANT_ENABLED'), true);
}

function parseRoleAllowlist(raw: string | undefined): UserRole[] | null {
  if (!raw) return null;
  const roles = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const valid = roles.filter((role): role is UserRole =>
    CHAT_ROLES.includes(role as UserRole),
  );
  return valid.length > 0 ? valid : null;
}

function perRoleEnvKey(role: UserRole): string {
  return `RECRUITER_ASSISTANT_ENABLED_${role.toUpperCase()}`;
}

/** Global + role-aware gate. Use this at request boundaries. */
export function isRecruiterAssistantEnabledForRole(role: UserRole): boolean {
  if (!isRecruiterAssistantEnabled()) return false;

  const perRoleRaw = trimEnv(perRoleEnvKey(role));
  if (perRoleRaw !== undefined) {
    return parseBooleanEnv(perRoleRaw, true);
  }

  const allowlist = parseRoleAllowlist(
    trimEnv('RECRUITER_ASSISTANT_ENABLED_ROLES'),
  );
  if (allowlist) {
    return allowlist.includes(role);
  }

  return true;
}
