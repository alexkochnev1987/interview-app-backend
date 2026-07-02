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

export function hasLocaleContent(
  question: ResolveQuestionInput,
  locale: Locale,
): boolean {
  return hasTranslation(effectiveTranslations(question), locale);
}

export function listContentLocales(question: ResolveQuestionInput): Locale[] {
  return listAvailableLocales(effectiveTranslations(question));
}

/** Requested locale when returned text came from a different locale in the chain. */
export function contentFallbackFromLocale(
  resolvedLocale: Locale,
  requestedLocale: Locale,
): Locale | undefined {
  return resolvedLocale !== requestedLocale ? requestedLocale : undefined;
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

function pickResolvedLocaleFromChain(
  translations: QuestionTranslations,
  chain: Locale[],
): Locale | undefined {
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

function pickResolvedLocale(
  translations: QuestionTranslations,
  requestedLocale: Locale,
  primaryLocale: Locale,
): Locale | undefined {
  return pickResolvedLocaleFromChain(translations, [requestedLocale, primaryLocale]);
}

function toLocalizedFields(
  questionText: string,
  followUpQuestions: string[],
  expectedConcepts: QuestionExpectedConcept[],
  redFlags: QuestionRedFlag[],
  sampleGoodAnswer?: string,
): Omit<ResolvedQuestion, 'resolvedLocale' | 'availableLocales'> {
  return {
    questionText,
    followUpQuestions,
    expectedConcepts,
    redFlags,
    sampleGoodAnswer,
  };
}

function hasCompleteRubricBlock(block?: QuestionTranslation): boolean {
  if (!block) {
    return false;
  }
  return (
    block.followUpQuestions !== undefined &&
    block.expectedConcepts !== undefined &&
    block.redFlags !== undefined
  );
}

function pickRubricSource(
  resolvedTranslation: QuestionTranslation | undefined,
  primaryTranslation: QuestionTranslation | undefined,
): QuestionTranslation | undefined {
  if (hasCompleteRubricBlock(resolvedTranslation)) {
    return resolvedTranslation;
  }
  return primaryTranslation;
}

export interface ResolveQuestionOptions {
  localeFallbackChain?: Locale[];
}

export function resolveQuestion(
  question: ResolveQuestionInput,
  requestedLocale: Locale,
  options?: ResolveQuestionOptions,
): ResolvedQuestion {
  const translations = effectiveTranslations(question);
  const availableLocales = listAvailableLocales(translations);
  const resolvedLocale =
    (options?.localeFallbackChain
      ? pickResolvedLocaleFromChain(translations, [
          ...options.localeFallbackChain,
          question.primaryLocale,
        ])
      : pickResolvedLocale(translations, requestedLocale, question.primaryLocale)) ??
    question.primaryLocale;
  const resolvedTranslation = translations[resolvedLocale];
  const primaryTranslation = translations[question.primaryLocale];

  const questionText =
    resolvedTranslation?.questionText?.trim() || question.questionText;

  const rubricSource = pickRubricSource(
    resolvedTranslation,
    primaryTranslation,
  );

  const followUpQuestions =
    rubricSource?.followUpQuestions ?? question.followUpQuestions;
  const expectedConcepts =
    rubricSource?.expectedConcepts ?? question.expectedConcepts;
  const redFlags = rubricSource?.redFlags ?? question.redFlags;
  const sampleGoodAnswer =
    rubricSource?.sampleGoodAnswer ?? question.sampleGoodAnswer;

  const rubricFallbackFromPrimary =
    resolvedLocale !== question.primaryLocale &&
    rubricSource !== resolvedTranslation;

  const fields = toLocalizedFields(
    questionText,
    followUpQuestions,
    expectedConcepts,
    redFlags,
    sampleGoodAnswer,
  );

  const resolved: ResolvedQuestion = {
    ...fields,
    resolvedLocale,
    availableLocales,
  };
  const textFallback = contentFallbackFromLocale(resolvedLocale, requestedLocale);
  if (textFallback) {
    resolved.fallbackFromLocale = textFallback;
  } else if (rubricFallbackFromPrimary) {
    resolved.fallbackFromLocale = requestedLocale;
  }
  return resolved;
}
