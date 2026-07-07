import { Locale } from '../locale/locale.constants';
import { primaryLocaleToOutputLanguage } from '../question/question-locale';
import { resolveQuestion } from '../question/resolve-question';
import { toResolveQuestionInput } from '../question/to-resolve-question-input';
import { InterviewQuestion } from './interfaces/interview.interface';

export function prepareQuestionForEvaluation(
  question: InterviewQuestion,
  interviewLocale: Locale,
): InterviewQuestion {
  const resolved = resolveQuestion(
    toResolveQuestionInput(question),
    interviewLocale,
  );

  return {
    ...question,
    questionText: resolved.questionText,
    followUpQuestions: resolved.followUpQuestions,
    expectedConcepts: resolved.expectedConcepts,
    redFlags: resolved.redFlags,
    sampleGoodAnswer: resolved.sampleGoodAnswer,
    outputLanguage: primaryLocaleToOutputLanguage(interviewLocale),
  };
}
