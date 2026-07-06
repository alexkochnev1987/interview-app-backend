import { applyTranslationsUpdate } from './question-translations-update';
import { QuestionTranslations } from './interfaces/question.interface';

const block = (text: string) => ({
  questionText: text,
  followUpQuestions: [],
  expectedConcepts: [],
  redFlags: [],
});

describe('applyTranslationsUpdate', () => {
  const existing: QuestionTranslations = {
    en: block('en'),
    ru: block('ru'),
  };

  it('merge upserts locales and keeps others', () => {
    const incoming: QuestionTranslations = {
      pl: block('pl'),
      en: block('en updated'),
    };

    const result = applyTranslationsUpdate(existing, incoming, 'merge');

    expect(result.en?.questionText).toBe('en updated');
    expect(result.ru?.questionText).toBe('ru');
    expect(result.pl?.questionText).toBe('pl');
  });

  it('replace drops locales not in the payload', () => {
    const incoming: QuestionTranslations = {
      en: block('en only'),
    };

    const result = applyTranslationsUpdate(existing, incoming, 'replace');

    expect(result).toEqual(incoming);
    expect(result.ru).toBeUndefined();
  });
});
