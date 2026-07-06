import { DEFAULT_LOCALE, Locale } from '../locale/locale.constants';

export function resolveDraftLocale(
  bodyLocale: Locale | undefined,
  headerLocale: Locale,
): Locale {
  return bodyLocale ?? headerLocale ?? DEFAULT_LOCALE;
}
