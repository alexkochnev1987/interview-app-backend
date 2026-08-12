import { Injectable } from '@nestjs/common';

import { UserRole } from '../user/interfaces/user.interface';
import { AppConfigService } from './app-config.service';

const CHAT_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'hr',
  'candidate',
];

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

function perRoleConfigKey(role: UserRole): string {
  return `RECRUITER_ASSISTANT_ENABLED_${role.toUpperCase()}`;
}

@Injectable()
export class RecruiterAssistantConfigService {
  constructor(private readonly appConfig: AppConfigService) {}

  /** Default: enabled when unset (backward compatible). */
  async isRecruiterAssistantEnabled(): Promise<boolean> {
    const primary = await this.appConfig.getString(
      'RECRUITER_ASSISTANT_ENABLED',
    );
    if (primary !== undefined) {
      return this.appConfig.getBoolean('RECRUITER_ASSISTANT_ENABLED', true);
    }
    return this.appConfig.getBoolean('ENABLE_AI_ASSISTANT', true);
  }

  /** Global + role-aware gate. Use this at request boundaries. */
  async isRecruiterAssistantEnabledForRole(role: UserRole): Promise<boolean> {
    if (!(await this.isRecruiterAssistantEnabled())) return false;

    const perRoleKey = perRoleConfigKey(role);
    const perRoleRaw = await this.appConfig.getString(perRoleKey);
    if (perRoleRaw !== undefined) {
      return this.appConfig.getBoolean(perRoleKey, true);
    }

    const allowlist = parseRoleAllowlist(
      await this.appConfig.getString('RECRUITER_ASSISTANT_ENABLED_ROLES'),
    );
    if (allowlist) {
      return allowlist.includes(role);
    }

    return true;
  }
}
