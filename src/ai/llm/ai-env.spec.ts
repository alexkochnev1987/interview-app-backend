import { normalizeAiProvider, resolveNativeProvider } from './ai-env';

describe('ai-env', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('normalizes provider aliases', () => {
    expect(normalizeAiProvider('gpt')).toBe('openai');
    expect(normalizeAiProvider('claude')).toBe('anthropic');
    expect(normalizeAiProvider('gemini')).toBe('google');
    expect(normalizeAiProvider('unknown')).toBeUndefined();
    expect(normalizeAiProvider(undefined)).toBeUndefined();
  });

  it('returns null when provider is unset', () => {
    delete process.env.AI_PROVIDER;
    expect(resolveNativeProvider()).toBeNull();
  });

  it('returns null when provider is set without a matching API key', () => {
    process.env.AI_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;
    expect(resolveNativeProvider()).toBeNull();
  });

  it('resolves OpenAI config with default model', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.OPENAI_MODEL;

    expect(resolveNativeProvider()).toEqual({
      kind: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    });
  });

  it('resolves Google config from alternate env keys', () => {
    process.env.AI_PROVIDER = 'google';
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.GEMINI_MODEL = 'gemini-test';

    expect(resolveNativeProvider()).toEqual({
      kind: 'google',
      apiKey: 'gem-key',
      model: 'gemini-test',
    });
  });
});
