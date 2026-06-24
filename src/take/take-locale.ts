import { DEFAULT_LOCALE, isLocale, Locale } from '../locale/locale.constants';
import { Interview } from '../interview/interfaces/interview.interface';
import { invalidContentLocaleException } from '../locale/locale.exceptions';

export interface TakeContentLocaleResolution {
  requestedLocale: Locale;
  localeFallbackChain: Locale[];
}

export function resolveTakeContentLocale(
  contentLocale: string | undefined,
  interview: Interview,
): TakeContentLocaleResolution {
  const interviewLocale = interview.interviewLocale ?? DEFAULT_LOCALE;

  if (contentLocale === undefined || contentLocale.trim() === '') {
    return {
      requestedLocale: interviewLocale,
      localeFallbackChain: [interviewLocale],
    };
  }

  const trimmed = contentLocale.trim();
  if (!isLocale(trimmed)) {
    throw invalidContentLocaleException();
  }

  return {
    requestedLocale: trimmed,
    localeFallbackChain: [trimmed, interviewLocale],
  };
}
