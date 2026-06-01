import { localeUiText } from '../locale/locale-ui-text';

describe('similar match reasons (X-Locale)', () => {
  it('uses Polish labels for pl locale', () => {
    const text = localeUiText('pl');
    expect(text.similarSameCategory('react')).toBe('Ta sama kategoria: react');
    expect(text.similarSameDifficulty('medium')).toContain('poziom');
  });
});
