import { CandidateQuestionView } from '../interview/interfaces/interview.interface';
import { InterviewQuestion } from '../interview/interfaces/interview.interface';
import {
  contentFallbackFromLocale,
  resolveQuestion,
} from '../question/resolve-question';
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
  const fallbackFromLocale = contentFallbackFromLocale(
    resolved.resolvedLocale,
    contentLocale.requestedLocale,
  );
  return {
    text: resolved.questionText,
    followUpQuestions: resolved.followUpQuestions,
    resolvedLocale: resolved.resolvedLocale,
    ...(fallbackFromLocale ? { fallbackFromLocale } : {}),
  };
}
