import {
  parseRecruiterAssistantBoolean,
  parseRecruiterAssistantRoleAllowlist,
  recruiterAssistantPerRoleEnvKey,
} from '../../app-config/recruiter-assistant-role-config';
import { UserRole } from '../../user/interfaces/user.interface';

function trimEnv(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Default: enabled when unset (backward compatible). */
export function isRecruiterAssistantEnabled(): boolean {
  return parseRecruiterAssistantBoolean(
    trimEnv('RECRUITER_ASSISTANT_ENABLED'),
    true,
  );
}

/** Global + role-aware gate. Use this at request boundaries. */
export function isRecruiterAssistantEnabledForRole(role: UserRole): boolean {
  if (!isRecruiterAssistantEnabled()) return false;

  const perRoleRaw = trimEnv(recruiterAssistantPerRoleEnvKey(role));
  if (perRoleRaw !== undefined) {
    return parseRecruiterAssistantBoolean(perRoleRaw, true);
  }

  const allowlist = parseRecruiterAssistantRoleAllowlist(
    trimEnv('RECRUITER_ASSISTANT_ENABLED_ROLES'),
  );
  if (allowlist) {
    return allowlist.includes(role);
  }

  return true;
}
