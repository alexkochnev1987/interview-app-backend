import { evaluationLocaleText } from '../interview/evaluation-locale-text';

describe('similar match reasons (X-Locale)', () => {
  it('uses Polish labels for pl locale', () => {
    const text = evaluationLocaleText('pl');
    expect(text.similarSameCategory('react')).toBe('Ta sama kategoria: react');
    expect(text.similarSameDifficulty('medium')).toContain('poziom');
  });
});
