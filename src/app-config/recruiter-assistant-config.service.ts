import { Injectable } from '@nestjs/common';

import { UserRole } from '../user/interfaces/user.interface';
import { AppConfigService } from './app-config.service';
import {
  parseRecruiterAssistantBoolean,
  parseRecruiterAssistantRoleAllowlist,
  recruiterAssistantPerRoleConfigKey,
} from './recruiter-assistant-role-config';

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

    const perRoleKey = recruiterAssistantPerRoleConfigKey(role);
    const perRoleRaw = await this.appConfig.getExplicitString(perRoleKey);
    if (perRoleRaw !== undefined) {
      return parseRecruiterAssistantBoolean(perRoleRaw, true);
    }

    const allowlist = parseRecruiterAssistantRoleAllowlist(
      await this.appConfig.getExplicitString(
        'RECRUITER_ASSISTANT_ENABLED_ROLES',
      ),
    );
    if (allowlist) {
      return allowlist.includes(role);
    }

    return true;
  }
}
