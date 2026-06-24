import { CandidateQuestionView } from '../interview/interfaces/interview.interface';
import { InterviewQuestion } from '../interview/interfaces/interview.interface';
import { resolveQuestion } from '../question/resolve-question';
import { toResolveQuestionInput } from '../question/to-resolve-question-input';
import { TakeContentLocaleResolution } from './take-locale';

export function buildCandidateQuestionView(
  question: InterviewQuestion,
  contentLocale: TakeContentLocaleResolution,
): CandidateQuestionView {
  const resolved = resolveQuestion(
    toResolveQuestionInput(question),
    contentLocale.requestedLocale,
    { localeFallbackChain: contentLocale.localeFallbackChain },
  );
  const view: CandidateQuestionView = {
    text: resolved.questionText,
    followUpQuestions: resolved.followUpQuestions,
    resolvedLocale: resolved.resolvedLocale,
  };
  if (resolved.resolvedLocale !== contentLocale.requestedLocale) {
    view.fallbackFromLocale = contentLocale.requestedLocale;
  }
  return view;
}
