import { Interview } from './interfaces/interview.interface';
import {
  resolveInterviewQuestions,
  ResolvedInterviewQuestion,
} from './resolve-interview-question';

export type InterviewPresentation = Omit<Interview, 'questions'> & {
  /** Locale used to resolve `questions[]` (always interviewLocale). */
  questionsDisplayLocale: Interview['interviewLocale'];
  questions: ResolvedInterviewQuestion[];
};

export function presentInterview(
  interview: Interview,
): InterviewPresentation {
  return {
    ...interview,
    result: interview.result
      ? {
          ...interview.result,
          interviewLocale: interview.interviewLocale,
        }
      : undefined,
    questionsDisplayLocale: interview.interviewLocale,
    questions: resolveInterviewQuestions(interview.questions, interview.interviewLocale),
  };
}
