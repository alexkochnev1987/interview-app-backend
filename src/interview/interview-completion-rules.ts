import type { Interview } from './interfaces/interview.interface';

export const INTERVIEW_COMPLETE_REQUIRES_ALL_ANSWERS_MESSAGE =
  'Interview can only be completed after all answers are submitted';

export function getSubmittedAnswerCount(
  interview: Pick<Interview, 'answers'>,
): number {
  return interview.answers.filter((answer) => answer.status === 'submitted')
    .length;
}

export function getInterviewCompletionBlockReason(
  interview: Pick<Interview, 'answers' | 'questions'>,
): string | null {
  if (getSubmittedAnswerCount(interview) < interview.questions.length) {
    return INTERVIEW_COMPLETE_REQUIRES_ALL_ANSWERS_MESSAGE;
  }
  return null;
}
