import { normalizeAiProvider, resolveNativeProvider } from './ai-env';

describe('ai-env', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  describe('normalizeAiProvider', () => {
    it.each([
      ['openai', 'openai'],
      ['gpt-4', 'openai'],
      ['claude', 'anthropic'],
      ['gemini', 'google'],
      ['unknown-vendor', undefined],
      [undefined, undefined],
    ] as const)('maps %s → %s', (input, expected) => {
      expect(normalizeAiProvider(input)).toBe(expected);
    });
  });

  describe('resolveNativeProvider', () => {
    it('returns null when provider or API key is missing', () => {
      delete process.env.AI_PROVIDER;
      expect(resolveNativeProvider()).toBeNull();

      process.env.AI_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;
      expect(resolveNativeProvider()).toBeNull();
    });

    it('resolves OpenAI from gpt alias and default model', () => {
      process.env.AI_PROVIDER = 'gpt';
      process.env.OPENAI_API_KEY = 'sk-test';
      delete process.env.OPENAI_MODEL;

      expect(resolveNativeProvider()).toEqual({
        kind: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
      });
    });
  });
});
