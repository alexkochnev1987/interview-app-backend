import { Locale } from '../locale/locale.constants';
import { CandidateQuestionView } from '../interview/interfaces/interview.interface';
import { InterviewQuestion } from '../interview/interfaces/interview.interface';
import { resolveQuestion, ResolveQuestionInput } from '../question/resolve-question';

export function buildCandidateQuestionView(
  question: InterviewQuestion,
  requestedLocale: Locale,
): CandidateQuestionView {
  const input: ResolveQuestionInput = {
    primaryLocale: question.primaryLocale,
    translations: question.translations,
    questionText: question.questionText,
    followUpQuestions: question.followUpQuestions,
    expectedConcepts: question.expectedConcepts,
    redFlags: question.redFlags,
    sampleGoodAnswer: question.sampleGoodAnswer,
  };
  const resolved = resolveQuestion(input, requestedLocale);
  const view: CandidateQuestionView = {
    text: resolved.questionText,
    followUpQuestions: resolved.followUpQuestions,
    resolvedLocale: resolved.resolvedLocale,
  };
  if (resolved.resolvedLocale !== requestedLocale) {
    view.fallbackFromLocale = requestedLocale;
  }
  return view;
}
