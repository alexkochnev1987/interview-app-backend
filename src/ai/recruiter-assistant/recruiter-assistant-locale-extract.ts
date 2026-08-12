import {
  isLocale,
  Locale,
  parseLocaleHeader,
} from '../../locale/locale.constants';

const LOCALE_ALIASES: Record<string, Locale> = {
  english: 'en',
  belarusian: 'be',
  belarus: 'be',
  russian: 'ru',
  polish: 'pl',
  английский: 'en',
  белорусский: 'be',
  русский: 'ru',
  польский: 'pl',
};

const SWITCH_LOCALE_PATTERNS = [
  /\b(?:switch|change|set)\s+(?:the\s+)?(?:app(?:lication)?\s+)?(?:locale|language)\s+(?:to\s+)([\p{L}\p{N}-]+)/iu,
  /\b(?:switch|change|set)\s+(?:locale|language)\s+(?:to\s+)?([\p{L}\p{N}-]+)/iu,
  /\blocale\s+(?:to\s+)([\p{L}\p{N}-]+)/iu,
  /\b(?:переключ(?:и|ить)|смен(?:и|ить))\s+(?:язык|locale)\s+(?:на\s+)([\p{L}\p{N}-]+)/iu,
];

export function matchesSwitchLocaleIntent(message: string): boolean {
  return SWITCH_LOCALE_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

export function extractRequestedLocale(message: string): Locale | null {
  for (const pattern of SWITCH_LOCALE_PATTERNS) {
    const match = message.trim().match(pattern);
    const raw = match?.[1]?.trim().toLowerCase();
    if (!raw) {
      continue;
    }
    const parsed = parseLocaleHeader(raw);
    if (parsed) {
      return parsed;
    }
    const alias = LOCALE_ALIASES[raw];
    if (alias) {
      return alias;
    }
  }
  return null;
}

export function isSupportedLocale(value: string): value is Locale {
  return isLocale(value);
}

export function extractLocaleToken(message: string): string | undefined {
  const match = message
    .trim()
    .match(
      /\b(?:switch|change|set)\s+(?:the\s+)?(?:app(?:lication)?\s+)?(?:locale|language)\s+to\s+(\S+)/i,
    );
  return match?.[1]?.replace(/[.!?]+$/, '');
}
