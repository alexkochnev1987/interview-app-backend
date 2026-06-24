import { Locale } from '../locale/locale.constants';
import {
  QuestionExpectedConcept,
  QuestionRedFlag,
  QuestionTranslations,
} from './interfaces/question.interface';
import { ResolveQuestionInput, resolveQuestion } from './resolve-question';

const concept: QuestionExpectedConcept = {
  id: 'c1',
  label: 'Testing',
  weight: 1,
  description: 'desc',
};

const redFlag: QuestionRedFlag = {
  id: 'r1',
  label: 'Vague answer',
  severity: 'medium',
};

function makeQuestion(
  overrides: Partial<ResolveQuestionInput> = {},
): ResolveQuestionInput {
  return {
    primaryLocale: 'ru',
    translations: {},
    questionText: 'legacy text',
    followUpQuestions: ['legacy follow-up'],
    expectedConcepts: [concept],
    redFlags: [redFlag],
    sampleGoodAnswer: 'legacy sample',
    ...overrides,
  };
}

function translation(
  locale: Locale,
  questionText: string,
): QuestionTranslations {
  return {
    [locale]: {
      questionText,
      followUpQuestions: [`${locale} follow-up`],
      expectedConcepts: [
        { ...concept, label: `${locale} concept` },
      ],
      redFlags: [{ ...redFlag, label: `${locale} flag` }],
      sampleGoodAnswer: `${locale} sample`,
    },
  };
}

describe('resolveQuestion', () => {
  it('uses requested locale when present', () => {
    const question = makeQuestion({
      translations: {
        ...translation('en', 'en text'),
        ...translation('ru', 'ru text'),
        ...translation('pl', 'pl text'),
      },
    });

    const result = resolveQuestion(question, 'pl');

    expect(result.resolvedLocale).toBe('pl');
    expect(result.questionText).toBe('pl text');
    expect(result.followUpQuestions).toEqual(['pl follow-up']);
    expect(result.availableLocales).toEqual(['en', 'ru', 'pl']);
  });

  it('falls back to primaryLocale when requested is missing', () => {
    const question = makeQuestion({
      primaryLocale: 'be',
      translations: {
        ...translation('en', 'en text'),
        ...translation('be', 'be text'),
      },
    });

    const result = resolveQuestion(question, 'pl');

    expect(result.resolvedLocale).toBe('be');
    expect(result.questionText).toBe('be text');
  });

  it('falls back to en when requested and primary are missing', () => {
    const question = makeQuestion({
      primaryLocale: 'pl',
      translations: {
        ...translation('en', 'en text'),
        ...translation('ru', 'ru text'),
      },
    });

    const result = resolveQuestion(question, 'pl');

    expect(result.resolvedLocale).toBe('en');
    expect(result.questionText).toBe('en text');
  });

  it('falls back to any available locale when requested, primary, and en are missing', () => {
    const question = makeQuestion({
      primaryLocale: 'en',
      translations: translation('ru', 'ru only'),
    });

    const result = resolveQuestion(question, 'pl');

    expect(result.resolvedLocale).toBe('ru');
    expect(result.questionText).toBe('ru only');
    expect(result.availableLocales).toEqual(['ru']);
  });

  it('skips duplicate locales in the fallback chain', () => {
    const question = makeQuestion({
      primaryLocale: 'en',
      translations: translation('be', 'be text'),
    });

    const result = resolveQuestion(question, 'en');

    expect(result.resolvedLocale).toBe('be');
    expect(result.questionText).toBe('be text');
  });

  it('uses legacy flat fields when translations are empty', () => {
    const question = makeQuestion({
      primaryLocale: 'ru',
      translations: {},
      questionText: 'legacy only',
      followUpQuestions: ['legacy fu'],
    });

    const result = resolveQuestion(question, 'pl');

    expect(result.resolvedLocale).toBe('ru');
    expect(result.questionText).toBe('legacy only');
    expect(result.followUpQuestions).toEqual(['legacy fu']);
    expect(result.availableLocales).toEqual(['ru']);
  });

  it('prefers requested over primary when both exist', () => {
    const question = makeQuestion({
      primaryLocale: 'ru',
      translations: {
        ...translation('ru', 'ru text'),
        ...translation('be', 'be text'),
      },
    });

    const result = resolveQuestion(question, 'be');

    expect(result.resolvedLocale).toBe('be');
    expect(result.questionText).toBe('be text');
  });

  it('uses custom locale fallback chain when provided', () => {
    const question = makeQuestion({
      primaryLocale: 'en',
      translations: {
        ...translation('en', 'en text'),
        ...translation('pl', 'pl text'),
      },
    });

    const result = resolveQuestion(question, 'ru', {
      localeFallbackChain: ['ru', 'pl'],
    });

    expect(result.resolvedLocale).toBe('pl');
    expect(result.fallbackFromLocale).toBe('ru');
  });
});
