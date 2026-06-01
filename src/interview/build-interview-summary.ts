import { Locale } from '../locale/locale.constants';
import { evaluationLocaleText } from './evaluation-locale-text';
import { InterviewQuestionResult } from './interfaces/interview.interface';

export function buildInterviewSummary(
  questionResults: InterviewQuestionResult[],
  interviewLocale: Locale,
): string {
  const text = evaluationLocaleText(interviewLocale);
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
