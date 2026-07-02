export const SUPPORTED_LOCALES = ['en', 'be', 'ru', 'pl'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_HEADER = 'x-locale';

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Normalize a BCP-47-style tag (trim, lowercase, drop regional subtag). */
export function parseLocaleHeader(raw: string): Locale | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const base = trimmed.toLowerCase().split('-')[0];
  return isLocale(base) ? base : null;
}
