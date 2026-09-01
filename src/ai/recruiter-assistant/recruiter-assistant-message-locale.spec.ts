import {
  detectMessageLocale,
  resolveConversationLocale,
} from './recruiter-assistant-message-locale';

describe('recruiter-assistant-message-locale', () => {
  it('detects Russian from Cyrillic text', () => {
    expect(detectMessageLocale('покажи все интервью', 'en')).toBe('ru');
  });

  it('detects Belarusian from distinctive markers', () => {
    expect(detectMessageLocale("пакажы ўсе інтэрв'ю", 'en')).toBe('be');
  });

  it('detects Polish from diacritics', () => {
    expect(detectMessageLocale('pokaż mój zespół', 'en')).toBe('pl');
  });

  it('detects English from Latin text via header fallback', () => {
    expect(detectMessageLocale('show my team', 'en')).toBeNull();
    expect(resolveConversationLocale('show my team', 'en')).toBe('en');
  });

  it('returns null for empty messages', () => {
    expect(detectMessageLocale('   ', 'en')).toBeNull();
  });

  it('prefers detected language over header locale', () => {
    expect(resolveConversationLocale('покажи hr', 'en')).toBe('ru');
  });

  it('keeps stored locale for language-neutral replies', () => {
    expect(resolveConversationLocale('yes', 'en', 'ru')).toBe('ru');
  });

  it('falls back to header locale when nothing is stored or detected', () => {
    expect(resolveConversationLocale('yes', 'pl')).toBe('pl');
  });
});
