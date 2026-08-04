function trimEnv(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Default: enabled when unset (backward compatible). */
export function isRecruiterAssistantEnabled(): boolean {
  const raw = trimEnv('RECRUITER_ASSISTANT_ENABLED');
  if (!raw) {
    return true;
  }
  const lower = raw.toLowerCase();
  if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'off') {
    return false;
  }
  return lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on';
}
