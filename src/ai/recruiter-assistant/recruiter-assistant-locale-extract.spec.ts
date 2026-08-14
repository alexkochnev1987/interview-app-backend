import {
  extractLocaleToken,
  extractQuestionLocaleFilter,
  extractRequestedLocale,
  matchesSwitchLocaleIntent,
} from './recruiter-assistant-locale-extract';

describe('recruiter-assistant-locale-extract', () => {
  it('matches switch locale phrasing', () => {
    expect(matchesSwitchLocaleIntent('switch locale to en')).toBe(true);
    expect(matchesSwitchLocaleIntent('show my interviews')).toBe(false);
  });

  it('extracts locale codes and aliases', () => {
    expect(extractRequestedLocale('switch locale to ru')).toBe('ru');
    expect(extractRequestedLocale('change language to polish')).toBe('pl');
    expect(extractRequestedLocale('switch locale to be')).toBe('be');
  });

  it('returns null for unsupported locales', () => {
    expect(extractRequestedLocale('switch locale to xx')).toBeNull();
  });

  it('extracts raw token when locale is invalid', () => {
    expect(extractLocaleToken('switch locale to klingon')).toBe('klingon');
  });

  it('extracts locale from question filter phrasing', () => {
    expect(extractQuestionLocaleFilter('show russian questions')).toBe('ru');
    expect(extractQuestionLocaleFilter('questions in language pl')).toBe('pl');
    expect(extractQuestionLocaleFilter('count questions in be')).toBe('be');
  });
});
