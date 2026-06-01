import { resolveDraftLocale } from './resolve-draft-locale';

describe('resolveDraftLocale', () => {
  it('prefers body locale over header', () => {
    expect(resolveDraftLocale('pl', 'en')).toBe('pl');
  });

  it('uses header when body locale is omitted', () => {
    expect(resolveDraftLocale(undefined, 'ru')).toBe('ru');
  });
});
