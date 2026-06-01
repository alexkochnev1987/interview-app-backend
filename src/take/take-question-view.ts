import { Locale } from '../locale/locale.constants';
import { CandidateQuestionView } from '../interview/interfaces/interview.interface';
import { InterviewQuestion } from '../interview/interfaces/interview.interface';
import { resolveQuestion } from '../question/resolve-question';
import { toResolveQuestionInput } from '../question/to-resolve-question-input';

export function buildCandidateQuestionView(
  question: InterviewQuestion,
  requestedLocale: Locale,
): CandidateQuestionView {
  const resolved = resolveQuestion(
    toResolveQuestionInput(question),
    requestedLocale,
  );
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
