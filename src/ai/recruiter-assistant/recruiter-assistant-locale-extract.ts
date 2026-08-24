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

const QUESTION_LOCALE_FILTER_PATTERNS = [
  /\b(?:in|with)\s+(?:language|locale)\s+([\p{L}\p{N}-]+)/iu,
  /\blanguage\s+(?:is\s+)?([\p{L}\p{N}-]+)/iu,
  /\bquestions?\s+in\s+([\p{L}\p{N}-]+)\b/iu,
  /\b(english|belarusian|russian|polish)\s+questions?\b/iu,
];

export function resolveLocaleToken(raw: string): Locale | null {
  const normalized = raw.trim().toLowerCase();
  const parsed = parseLocaleHeader(normalized);
  if (parsed) {
    return parsed;
  }
  return LOCALE_ALIASES[normalized] ?? null;
}

export function matchesSwitchLocaleIntent(message: string): boolean {
  return SWITCH_LOCALE_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

export function extractRequestedLocale(message: string): Locale | null {
  for (const pattern of SWITCH_LOCALE_PATTERNS) {
    const raw = message.trim().match(pattern)?.[1]?.trim();
    if (!raw) {
      continue;
    }
    const locale = resolveLocaleToken(raw);
    if (locale) {
      return locale;
    }
  }
  return null;
}

export function extractQuestionLocaleFilter(message: string): Locale | null {
  for (const pattern of QUESTION_LOCALE_FILTER_PATTERNS) {
    const raw = message.match(pattern)?.[1]?.trim();
    if (!raw) {
      continue;
    }
    const locale = resolveLocaleToken(raw);
    if (locale) {
      return locale;
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
