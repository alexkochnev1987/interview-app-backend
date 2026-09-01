import { Locale } from '../../locale/locale.constants';

const CYRILLIC = /\p{Script=Cyrillic}/u;
const POLISH_DIACRITICS = /[ąćęłńóśźż]/iu;
const BELARUSIAN_MARKERS =
  /(?:^|[^\p{L}])(?:пакаж|пытан|інт|каманд|мова|пераключ|скасув|прызнач|ствар|агляд|удзельн)/iu;

export function detectMessageLocale(
  message: string,
  fallback: Locale,
): Locale | null {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  if (POLISH_DIACRITICS.test(trimmed)) {
    return 'pl';
  }

  if (CYRILLIC.test(trimmed)) {
    if (BELARUSIAN_MARKERS.test(trimmed) || /[\u0456\u045E]/u.test(trimmed)) {
      return 'be';
    }
    return 'ru';
  }

  if (/\p{Script=Latin}/u.test(trimmed)) {
    return 'en';
  }

  return null;
}

export function resolveConversationLocale(
  message: string,
  headerLocale: Locale,
  storedLocale?: Locale,
): Locale {
  const detected = detectMessageLocale(message, headerLocale);
  if (detected) {
    return detected;
  }
  return storedLocale ?? headerLocale;
}
