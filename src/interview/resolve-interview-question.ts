import { Locale } from '../locale/locale.constants';
import { resolveQuestion } from '../question/resolve-question';
import { toResolveQuestionInput } from '../question/to-resolve-question-input';
import { InterviewQuestion } from './interfaces/interview.interface';

export type ResolvedInterviewQuestion = InterviewQuestion & {
  resolvedLocale: Locale;
  availableLocales: Locale[];
};

export function resolveInterviewQuestion(
  question: InterviewQuestion,
  locale: Locale,
): ResolvedInterviewQuestion {
  const resolved = resolveQuestion(toResolveQuestionInput(question), locale);

  return {
    ...question,
    questionText: resolved.questionText,
    followUpQuestions: resolved.followUpQuestions,
    expectedConcepts: resolved.expectedConcepts,
    redFlags: resolved.redFlags,
    sampleGoodAnswer: resolved.sampleGoodAnswer,
    resolvedLocale: resolved.resolvedLocale,
    availableLocales: resolved.availableLocales,
  };
}

export function resolveInterviewQuestions(
  questions: InterviewQuestion[],
  locale: Locale,
): ResolvedInterviewQuestion[] {
  return questions.map((question) => resolveInterviewQuestion(question, locale));
}
