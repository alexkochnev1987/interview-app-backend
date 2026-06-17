import { DEFAULT_LOCALE, Locale, isLocale } from '../locale/locale.constants';
import { apiBadRequest } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
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

export function rejectPrimaryLocaleChange(
  existing: Locale,
  requested: Locale | undefined,
): void {
  if (requested && requested !== existing) {
    throw apiBadRequest(
      ApiErrorCode.BAD_REQUEST,
      'primaryLocale cannot be changed after creation',
      { primaryLocale: requested, existingPrimaryLocale: existing },
    );
  }
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

const RED_FLAG_SEVERITIES = new Set(['low', 'medium', 'high']);

function parseStoredExpectedConcepts(items: unknown): QuestionExpectedConcept[] | undefined {
  if (!Array.isArray(items)) {
    return undefined;
  }
  const parsed: QuestionExpectedConcept[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.id === 'string' &&
      record.id.trim() &&
      typeof record.label === 'string' &&
      record.label.trim() &&
      typeof record.description === 'string' &&
      typeof record.weight === 'number' &&
      Number.isFinite(record.weight)
    ) {
      parsed.push({
        id: record.id.trim(),
        label: record.label.trim(),
        weight: record.weight,
        description: record.description.trim(),
      });
    }
  }
  return parsed.length > 0 ? parsed : undefined;
}

function parseStoredRedFlags(items: unknown): QuestionRedFlag[] | undefined {
  if (!Array.isArray(items)) {
    return undefined;
  }
  const parsed: QuestionRedFlag[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const severity = record.severity;
    if (
      typeof record.id === 'string' &&
      record.id.trim() &&
      typeof record.label === 'string' &&
      record.label.trim() &&
      typeof severity === 'string' &&
      RED_FLAG_SEVERITIES.has(severity)
    ) {
      parsed.push({
        id: record.id.trim(),
        label: record.label.trim(),
        severity: severity as QuestionRedFlag['severity'],
      });
    }
  }
  return parsed.length > 0 ? parsed : undefined;
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
    const expectedConcepts = parseStoredExpectedConcepts(record.expectedConcepts);
    const redFlags = parseStoredRedFlags(record.redFlags);
    translations[key] = {
      questionText,
      ...(Array.isArray(record.followUpQuestions)
        ? {
            followUpQuestions: record.followUpQuestions.filter(
              (item): item is string => typeof item === 'string',
            ),
          }
        : {}),
      ...(expectedConcepts ? { expectedConcepts } : {}),
      ...(redFlags ? { redFlags } : {}),
      ...(typeof record.sampleGoodAnswer === 'string'
        ? { sampleGoodAnswer: record.sampleGoodAnswer }
        : {}),
    };
  }
  return translations;
}

export function ensurePrimaryTranslationBlock(
  primaryLocale: Locale,
  translations: QuestionTranslations,
  legacy: QuestionLegacyFields,
): QuestionTranslations {
  if (translations[primaryLocale]?.questionText?.trim()) {
    return translations;
  }
  const questionText = legacy.questionText.trim();
  if (!questionText) {
    return translations;
  }
  return mergeTranslations(
    translations,
    primaryLocale,
    buildTranslation(legacy),
  );
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
