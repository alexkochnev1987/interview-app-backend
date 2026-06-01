import { Locale } from '../locale/locale.constants';
import { Interview } from './interfaces/interview.interface';
import {
  resolveInterviewQuestions,
  ResolvedInterviewQuestion,
} from './resolve-interview-question';

export type InterviewPresentation = Omit<Interview, 'questions'> & {
  /** Locale used to resolve `questions[]` (from `X-Locale`). */
  questionsDisplayLocale: Locale;
  questions: ResolvedInterviewQuestion[];
};

export function presentInterview(
  interview: Interview,
  locale: Locale,
): InterviewPresentation {
  return {
    ...interview,
    questionsDisplayLocale: locale,
    questions: resolveInterviewQuestions(interview.questions, locale),
  };
}
