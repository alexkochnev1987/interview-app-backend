import type { AnswerStatus } from './interfaces/interview.interface';

export function getAnswerValidationSubmissionBlockReason(
  questionIndex: number,
  answer: { status: AnswerStatus } | undefined,
): string | null {
  if (!answer) {
    return `Answer for question ${questionIndex} is not available`;
  }
  if (answer.status !== 'submitted') {
    return `Question ${questionIndex} must be submitted before validation starts`;
  }
  return null;
}
