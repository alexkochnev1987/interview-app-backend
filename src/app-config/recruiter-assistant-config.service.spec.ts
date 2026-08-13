import { vi } from 'vitest';
import type { Mocked } from 'vitest';

import { AppConfigService } from './app-config.service';
import { RecruiterAssistantConfigService } from './recruiter-assistant-config.service';

describe('RecruiterAssistantConfigService', () => {
  let appConfig: Mocked<
    Pick<AppConfigService, 'getString' | 'getBoolean' | 'getExplicitString'>
  >;
  let service: RecruiterAssistantConfigService;

  beforeEach(() => {
    appConfig = {
      getString: vi.fn(),
      getBoolean: vi.fn(),
      getExplicitString: vi.fn(),
    };
    service = new RecruiterAssistantConfigService(
      appConfig as unknown as AppConfigService,
    );
  });

  it('respects allowlist when per-role keys are only system defaults', async () => {
    appConfig.getString.mockImplementation(async (key: string) => {
      if (key === 'RECRUITER_ASSISTANT_ENABLED') return 'true';
      return undefined;
    });
    appConfig.getBoolean.mockResolvedValue(true);
    appConfig.getExplicitString.mockImplementation(async (key: string) => {
      if (key === 'RECRUITER_ASSISTANT_ENABLED_ROLES') {
        return 'admin,hr';
      }
      return undefined;
    });

    await expect(
      service.isRecruiterAssistantEnabledForRole('admin'),
    ).resolves.toBe(true);
    await expect(
      service.isRecruiterAssistantEnabledForRole('candidate'),
    ).resolves.toBe(false);
  });

  it('uses explicit per-role override over allowlist', async () => {
    appConfig.getString.mockImplementation(async (key: string) => {
      if (key === 'RECRUITER_ASSISTANT_ENABLED') return 'true';
      return undefined;
    });
    appConfig.getBoolean.mockResolvedValue(true);
    appConfig.getExplicitString.mockImplementation(async (key: string) => {
      if (key === 'RECRUITER_ASSISTANT_ENABLED_ROLES') return 'admin';
      if (key === 'RECRUITER_ASSISTANT_ENABLED_CANDIDATE') return 'true';
      return undefined;
    });

    await expect(
      service.isRecruiterAssistantEnabledForRole('candidate'),
    ).resolves.toBe(true);
  });

  it('honours explicit per-role disable', async () => {
    appConfig.getString.mockImplementation(async (key: string) => {
      if (key === 'RECRUITER_ASSISTANT_ENABLED') return 'true';
      return undefined;
    });
    appConfig.getBoolean.mockResolvedValue(true);
    appConfig.getExplicitString.mockImplementation(async (key: string) => {
      if (key === 'RECRUITER_ASSISTANT_ENABLED_ADMIN') return 'false';
      return undefined;
    });

    await expect(
      service.isRecruiterAssistantEnabledForRole('admin'),
    ).resolves.toBe(false);
  });
});
