import { Locale } from '../locale/locale.constants';
import {
  resolveQuestion,
  ResolveQuestionInput,
} from '../question/resolve-question';
import { InterviewQuestion } from './interfaces/interview.interface';

export type ResolvedInterviewQuestion = InterviewQuestion & {
  resolvedLocale: Locale;
  availableLocales: Locale[];
};

export function resolveInterviewQuestion(
  question: InterviewQuestion,
  locale: Locale,
): ResolvedInterviewQuestion {
  const input: ResolveQuestionInput = {
    primaryLocale: question.primaryLocale,
    translations: question.translations,
    questionText: question.questionText,
    followUpQuestions: question.followUpQuestions,
    expectedConcepts: question.expectedConcepts,
    redFlags: question.redFlags,
    sampleGoodAnswer: question.sampleGoodAnswer,
  };
  const resolved = resolveQuestion(input, locale);

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
