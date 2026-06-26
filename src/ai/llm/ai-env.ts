export type NativeAiProviderKind = 'openai' | 'anthropic' | 'google';

export interface NativeProviderConfig {
  readonly kind: NativeAiProviderKind;
  readonly apiKey: string;
  readonly model: string;
}

function trimEnv(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Normalizes AI_PROVIDER: gpt→openai, claude→anthropic, gemini→google */
export function normalizeAiProvider(
  raw: string | undefined,
): NativeAiProviderKind | undefined {
  if (!raw) {
    return undefined;
  }
  const lower = raw.trim().toLowerCase();
  if (
    lower === 'openai' ||
    lower === 'gpt' ||
    lower === 'gpt-4' ||
    lower === 'gpt4'
  ) {
    return 'openai';
  }
  if (lower === 'anthropic' || lower === 'claude') {
    return 'anthropic';
  }
  if (lower === 'google' || lower === 'gemini') {
    return 'google';
  }
  return undefined;
}

/**
 * Resolved when AI_PROVIDER + the matching API key + model env are usable.
 * If unset, native LLM paths are skipped (legacy URL or heuristics apply).
 */
export function resolveNativeProvider(): NativeProviderConfig | null {
  const kind = normalizeAiProvider(trimEnv('AI_PROVIDER'));
  if (!kind) {
    return null;
  }

  if (kind === 'openai') {
    const apiKey = trimEnv('OPENAI_API_KEY');
    if (!apiKey) {
      return null;
    }
    const model = trimEnv('OPENAI_MODEL') ?? 'gpt-4o-mini';
    return { kind, apiKey, model };
  }

  if (kind === 'anthropic') {
    const apiKey = trimEnv('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return null;
    }
    const model =
      trimEnv('ANTHROPIC_MODEL') ??
      trimEnv('CLAUDE_MODEL') ??
      'claude-3-5-haiku-20241022';
    return { kind, apiKey, model };
  }

  const apiKey =
    trimEnv('GOOGLE_AI_API_KEY') ??
    trimEnv('GEMINI_API_KEY') ??
    trimEnv('GOOGLE_API_KEY');
  if (!apiKey) {
    return null;
  }
  const model =
    trimEnv('GOOGLE_AI_MODEL') ??
    trimEnv('GEMINI_MODEL') ??
    'gemini-2.5-flash-lite';
  return { kind: 'google', apiKey, model };
}

const DEFAULT_NATIVE_LLM_TIMEOUT_MS = 120_000;

/** Upper bound for a single native LLM HTTP call (generate, translate, evaluation). */
export function resolveNativeLlmTimeoutMs(): number {
  const raw = trimEnv('AI_LLM_TIMEOUT_MS');
  if (!raw) {
    return DEFAULT_NATIVE_LLM_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_NATIVE_LLM_TIMEOUT_MS;
  }
  return parsed;
}
