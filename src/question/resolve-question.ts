import { Locale, SUPPORTED_LOCALES } from '../locale/locale.constants';
import {
  QuestionExpectedConcept,
  QuestionRedFlag,
  QuestionTranslation,
  QuestionTranslations,
} from './interfaces/question.interface';
import { buildTranslation, mergeTranslations } from './question-locale';

export interface ResolveQuestionInput {
  primaryLocale: Locale;
  translations: QuestionTranslations;
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  sampleGoodAnswer?: string;
}

export interface ResolvedQuestion {
  resolvedLocale: Locale;
  availableLocales: Locale[];
  fallbackFromLocale?: Locale;
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  sampleGoodAnswer?: string;
}

function hasTranslation(
  translations: QuestionTranslations,
  locale: Locale,
): boolean {
  return Boolean(translations[locale]?.questionText?.trim());
}

export function listAvailableLocales(translations: QuestionTranslations): Locale[] {
  return SUPPORTED_LOCALES.filter((locale) => hasTranslation(translations, locale));
}

function effectiveTranslations(question: ResolveQuestionInput): QuestionTranslations {
  if (listAvailableLocales(question.translations).length > 0) {
    return question.translations;
  }
  if (!question.questionText.trim()) {
    return question.translations;
  }
  return mergeTranslations(
    question.translations,
    question.primaryLocale,
    buildTranslation({
      questionText: question.questionText,
      followUpQuestions: question.followUpQuestions,
      expectedConcepts: question.expectedConcepts,
      redFlags: question.redFlags,
      sampleGoodAnswer: question.sampleGoodAnswer,
    }),
  );
}

function pickResolvedLocale(
  translations: QuestionTranslations,
  requestedLocale: Locale,
  primaryLocale: Locale,
): Locale | undefined {
  const chain: Locale[] = [requestedLocale, primaryLocale];
  const seen = new Set<Locale>();
  for (const locale of chain) {
    if (seen.has(locale)) {
      continue;
    }
    seen.add(locale);
    if (hasTranslation(translations, locale)) {
      return locale;
    }
  }
  return listAvailableLocales(translations)[0];
}

function toLocalizedFields(
  translation: QuestionTranslation,
): Omit<ResolvedQuestion, 'resolvedLocale' | 'availableLocales'> {
  return {
    questionText: translation.questionText,
    followUpQuestions: translation.followUpQuestions,
    expectedConcepts: translation.expectedConcepts,
    redFlags: translation.redFlags,
    sampleGoodAnswer: translation.sampleGoodAnswer,
  };
}

export function resolveQuestion(
  question: ResolveQuestionInput,
  requestedLocale: Locale,
): ResolvedQuestion {
  const translations = effectiveTranslations(question);
  const availableLocales = listAvailableLocales(translations);
  const resolvedLocale =
    pickResolvedLocale(translations, requestedLocale, question.primaryLocale) ??
    question.primaryLocale;
  const translation = translations[resolvedLocale];

  const fields = translation
    ? toLocalizedFields(translation)
    : toLocalizedFields(
        buildTranslation({
          questionText: question.questionText,
          followUpQuestions: question.followUpQuestions,
          expectedConcepts: question.expectedConcepts,
          redFlags: question.redFlags,
          sampleGoodAnswer: question.sampleGoodAnswer,
        }),
      );

  const resolved: ResolvedQuestion = {
    ...fields,
    resolvedLocale,
    availableLocales,
  };
  if (resolvedLocale !== requestedLocale) {
    resolved.fallbackFromLocale = requestedLocale;
  }
  return resolved;
}
