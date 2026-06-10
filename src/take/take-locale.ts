import { Request } from 'express';
import { DEFAULT_LOCALE, Locale } from '../locale/locale.constants';
import { Interview } from '../interview/interfaces/interview.interface';

export function resolveTakeLocale(request: Request, interview: Interview): Locale {
  void request;
  return interview.interviewLocale ?? DEFAULT_LOCALE;
}
