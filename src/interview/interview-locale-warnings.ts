import { Locale } from '../locale/locale.constants';
import {
  hasLocaleContent,
  listContentLocales,
} from '../question/resolve-question';
import { toResolveQuestionInput } from '../question/to-resolve-question-input';
import { InterviewQuestion } from './interfaces/interview.interface';

export interface InterviewLocaleWarning {
  questionId: string;
  availableLocales: Locale[];
}

export function collectInterviewLocaleWarnings(
  questions: InterviewQuestion[],
  interviewLocale: Locale,
): InterviewLocaleWarning[] {
  return questions
    .filter((question) => {
      const input = toResolveQuestionInput(question);
      return !hasLocaleContent(input, interviewLocale);
    })
    .map((question) => ({
      questionId: question.id,
      availableLocales: listContentLocales(toResolveQuestionInput(question)),
    }));
}
