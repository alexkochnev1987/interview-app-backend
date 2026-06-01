import { isLocale, Locale, SUPPORTED_LOCALES } from '../locale/locale.constants';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isCompleteTranslationBlock(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  if (typeof value.questionText !== 'string' || !value.questionText.trim()) {
    return false;
  }
  if (!Array.isArray(value.followUpQuestions)) {
    return false;
  }
  if (!Array.isArray(value.expectedConcepts)) {
    return false;
  }
  if (!Array.isArray(value.redFlags)) {
    return false;
  }
  if (!value.followUpQuestions.every((item) => typeof item === 'string')) {
    return false;
  }
  return true;
}

export function validateTranslationMapKeys(translations: unknown): translations is Record<string, unknown> {
  if (!isPlainObject(translations)) {
    return false;
  }
  const keys = Object.keys(translations);
  if (keys.length === 0) {
    return false;
  }
  for (const key of keys) {
    if (!isLocale(key)) {
      return false;
    }
    if (!isCompleteTranslationBlock(translations[key])) {
      return false;
    }
  }
  return true;
}

export function validatePrimaryTranslationBlock(
  translations: Record<string, unknown>,
  primaryLocale: Locale,
): boolean {
  return isCompleteTranslationBlock(translations[primaryLocale]);
}

export function supportedLocaleListHint(): string {
  return SUPPORTED_LOCALES.join(', ');
}
