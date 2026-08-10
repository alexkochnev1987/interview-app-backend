import { isRecruiterAssistantEnabled, isRecruiterAssistantEnabledForRole } from './recruiter-assistant-env';

describe('recruiter-assistant-env', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('defaults to enabled when unset', () => {
    delete process.env.RECRUITER_ASSISTANT_ENABLED;
    expect(isRecruiterAssistantEnabled()).toBe(true);
  });

  it('parses disabled values', () => {
    for (const value of ['false', '0', 'no', 'off']) {
      process.env.RECRUITER_ASSISTANT_ENABLED = value;
      expect(isRecruiterAssistantEnabled()).toBe(false);
    }
  });

  it('parses enabled values', () => {
    for (const value of ['true', '1', 'yes', 'on']) {
      process.env.RECRUITER_ASSISTANT_ENABLED = value;
      expect(isRecruiterAssistantEnabled()).toBe(true);
    }
  });

  describe('isRecruiterAssistantEnabledForRole', () => {
    it('respects global disable regardless of role', () => {
      process.env.RECRUITER_ASSISTANT_ENABLED = 'false';
      process.env.RECRUITER_ASSISTANT_ENABLED_ROLES = 'admin';
      expect(isRecruiterAssistantEnabledForRole('admin')).toBe(false);
    });

    it('allows all roles when global on and no role config', () => {
      delete process.env.RECRUITER_ASSISTANT_ENABLED;
      delete process.env.RECRUITER_ASSISTANT_ENABLED_ROLES;
      delete process.env.RECRUITER_ASSISTANT_ENABLED_CANDIDATE;
      expect(isRecruiterAssistantEnabledForRole('candidate')).toBe(true);
    });

    it('respects allowlist', () => {
      process.env.RECRUITER_ASSISTANT_ENABLED = 'true';
      process.env.RECRUITER_ASSISTANT_ENABLED_ROLES = 'admin,hr';
      expect(isRecruiterAssistantEnabledForRole('admin')).toBe(true);
      expect(isRecruiterAssistantEnabledForRole('candidate')).toBe(false);
    });

    it('per-role override beats allowlist', () => {
      process.env.RECRUITER_ASSISTANT_ENABLED = 'true';
      process.env.RECRUITER_ASSISTANT_ENABLED_ROLES = 'admin';
      process.env.RECRUITER_ASSISTANT_ENABLED_ADMIN = 'false';
      expect(isRecruiterAssistantEnabledForRole('admin')).toBe(false);
    });

    it('per-role enable when not in allowlist', () => {
      process.env.RECRUITER_ASSISTANT_ENABLED = 'true';
      process.env.RECRUITER_ASSISTANT_ENABLED_ROLES = 'admin';
      process.env.RECRUITER_ASSISTANT_ENABLED_CANDIDATE = 'true';
      expect(isRecruiterAssistantEnabledForRole('candidate')).toBe(true);
    });
  });

});
