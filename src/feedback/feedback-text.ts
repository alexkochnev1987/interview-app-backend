import { Locale } from '../locale/locale.constants';
import { localeUiText } from '../locale/locale-ui-text';
import { InterviewQuestionResult } from '../interview/interfaces/interview.interface';

export function buildFeedbackImprovements(
  questionResults: InterviewQuestionResult[],
  interviewLocale: Locale,
): string | undefined {
  const text = localeUiText(interviewLocale);
  const weak = questionResults
    .filter(
      (item) =>
        (item.score ?? 100) < 70 ||
        item.decisionHint === 'fail' ||
        item.decisionHint === 'review',
    )
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0));

  if (weak.length === 0) {
    return undefined;
  }

  return weak
    .map((item) => {
      const label = text.questionLabel(item.questionIndex + 1);
      const score =
        item.score !== undefined ? text.scoreSuffix(item.score) : '';
      const detail = item.summary?.trim() || text.reviewThisArea;
      return `${label}${score}: ${detail}`;
    })
    .join('\n\n');
}
