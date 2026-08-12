import { UserRole } from '../user/interfaces/user.interface';

export const RECRUITER_ASSISTANT_CHAT_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'hr',
  'candidate',
];

export function parseRecruiterAssistantRoleAllowlist(
  raw: string | undefined,
): UserRole[] | null {
  if (!raw) return null;
  const roles = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const valid = roles.filter((role): role is UserRole =>
    RECRUITER_ASSISTANT_CHAT_ROLES.includes(role as UserRole),
  );
  return valid.length > 0 ? valid : null;
}

export function recruiterAssistantPerRoleConfigKey(role: UserRole): string {
  return `RECRUITER_ASSISTANT_ENABLED_${role.toUpperCase()}`;
}

export function recruiterAssistantPerRoleEnvKey(role: UserRole): string {
  return recruiterAssistantPerRoleConfigKey(role);
}

export function parseRecruiterAssistantBoolean(
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  if (!raw) return defaultValue;
  const lower = raw.trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(lower)) return false;
  if (['1', 'true', 'yes', 'on'].includes(lower)) return true;
  return defaultValue;
}
