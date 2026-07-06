import { Locale } from '../locale/locale.constants';
import { localeUiText } from '../locale/locale-ui-text';
import { InterviewQuestionResult } from './interfaces/interview.interface';

export function buildInterviewSummary(
  questionResults: InterviewQuestionResult[],
  interviewLocale: Locale,
): string {
  const text = localeUiText(interviewLocale);
  const lines = questionResults
    .map((item) =>
      item.summary?.trim()
        ? text.summaryQuestionLine(item.questionIndex + 1, item.summary.trim())
        : undefined,
    )
    .filter((line): line is string => Boolean(line));

  if (lines.length === 0) {
    return text.noPerQuestionSummaries;
  }
  return lines.join('\n');
}
