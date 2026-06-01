import { Request } from 'express';
import { DEFAULT_LOCALE, isLocale, LOCALE_HEADER, Locale } from '../locale/locale.constants';
import { Interview } from '../interview/interfaces/interview.interface';

export function resolveTakeLocale(request: Request, interview: Interview): Locale {
  const raw = request.headers[LOCALE_HEADER];
  if (raw !== undefined) {
    const value = (Array.isArray(raw) ? raw[0] : raw).trim();
    if (value && isLocale(value)) {
      return value;
    }
  }
  return interview.interviewLocale ?? DEFAULT_LOCALE;
}
