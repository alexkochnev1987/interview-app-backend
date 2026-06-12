import { DEFAULT_LOCALE, Locale, isLocale } from '../locale/locale.constants';
import {
  QuestionExpectedConcept,
  QuestionRedFlag,
  QuestionTranslation,
  QuestionTranslations,
} from './interfaces/question.interface';

const OUTPUT_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  en: 'English',
  be: 'Belarusian',
  ru: 'Russian',
  pl: 'Polish',
};

const OUTPUT_LANGUAGE_ALIASES: Record<string, Locale> = {
  en: 'en',
  english: 'en',
  be: 'be',
  belarusian: 'be',
  belarus: 'be',
  belarussian: 'be',
  ru: 'ru',
  russian: 'ru',
  russia: 'ru',
  pl: 'pl',
  polish: 'pl',
  poland: 'pl',
};

export function mapOutputLanguageToPrimaryLocale(
  outputLanguage: string | null | undefined,
): Locale {
  if (!outputLanguage?.trim()) {
    return DEFAULT_LOCALE;
  }
  const key = outputLanguage.trim().toLowerCase();
  return OUTPUT_LANGUAGE_ALIASES[key] ?? DEFAULT_LOCALE;
}

export function primaryLocaleToOutputLanguage(locale: Locale): string {
  return OUTPUT_LANGUAGE_BY_LOCALE[locale];
}

export function resolvePrimaryLocale(
  primaryLocale: string | null | undefined,
  outputLanguage: string | null | undefined,
): Locale {
  if (primaryLocale && isLocale(primaryLocale)) {
    return primaryLocale;
  }
  return mapOutputLanguageToPrimaryLocale(outputLanguage);
}

export interface QuestionLegacyFields {
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  sampleGoodAnswer?: string;
}

export function buildTranslation(fields: QuestionLegacyFields): QuestionTranslation {
  return {
    questionText: fields.questionText,
    followUpQuestions: fields.followUpQuestions,
    expectedConcepts: fields.expectedConcepts,
    redFlags: fields.redFlags,
    ...(fields.sampleGoodAnswer !== undefined
      ? { sampleGoodAnswer: fields.sampleGoodAnswer }
      : {}),
  };
}

export function mergeTranslations(
  existing: QuestionTranslations | undefined,
  locale: Locale,
  translation: QuestionTranslation,
): QuestionTranslations {
  return {
    ...(existing ?? {}),
    [locale]: translation,
  };
}

export function parseTranslationsJson(value: unknown): QuestionTranslations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const translations: QuestionTranslations = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!isLocale(key) || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const questionText =
      typeof record.questionText === 'string' ? record.questionText.trim() : '';
    if (!questionText) {
      continue;
    }
    translations[key] = {
      questionText,
      ...(Array.isArray(record.followUpQuestions)
        ? {
            followUpQuestions: record.followUpQuestions.filter(
              (item): item is string => typeof item === 'string',
            ),
          }
        : {}),
      ...(Array.isArray(record.expectedConcepts)
        ? { expectedConcepts: record.expectedConcepts as QuestionExpectedConcept[] }
        : {}),
      ...(Array.isArray(record.redFlags)
        ? { redFlags: record.redFlags as QuestionRedFlag[] }
        : {}),
      ...(typeof record.sampleGoodAnswer === 'string'
        ? { sampleGoodAnswer: record.sampleGoodAnswer }
        : {}),
    };
  }
  return translations;
}

export function resolveQuestionFields(
  primaryLocale: Locale,
  translations: QuestionTranslations,
  legacy: QuestionLegacyFields,
): QuestionLegacyFields & { primaryLocale: Locale; translations: QuestionTranslations } {
  const localized = translations[primaryLocale];
  if (localized?.questionText) {
    return {
      primaryLocale,
      translations,
      questionText: localized.questionText,
      followUpQuestions: localized.followUpQuestions ?? legacy.followUpQuestions,
      expectedConcepts: localized.expectedConcepts ?? legacy.expectedConcepts,
      redFlags: localized.redFlags ?? legacy.redFlags,
      sampleGoodAnswer: localized.sampleGoodAnswer ?? legacy.sampleGoodAnswer,
    };
  }

  return {
    primaryLocale,
    translations,
    ...legacy,
  };
}
