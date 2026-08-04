import { isRecruiterAssistantEnabled } from './recruiter-assistant-env';

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
});
