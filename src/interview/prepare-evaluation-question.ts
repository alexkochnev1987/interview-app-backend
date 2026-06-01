import { Locale } from '../locale/locale.constants';
import { primaryLocaleToOutputLanguage } from '../question/question-locale';
import {
  resolveQuestion,
  ResolveQuestionInput,
} from '../question/resolve-question';
import { InterviewQuestion } from './interfaces/interview.interface';

export function prepareQuestionForEvaluation(
  question: InterviewQuestion,
  interviewLocale: Locale,
): InterviewQuestion {
  const input: ResolveQuestionInput = {
    primaryLocale: question.primaryLocale,
    translations: question.translations,
    questionText: question.questionText,
    followUpQuestions: question.followUpQuestions,
    expectedConcepts: question.expectedConcepts,
    redFlags: question.redFlags,
    sampleGoodAnswer: question.sampleGoodAnswer,
  };
  const resolved = resolveQuestion(input, interviewLocale);

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
