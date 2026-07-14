import { CandidateFeedbackQuestion } from './interfaces/candidate-feedback.interface';

export interface CandidateFeedbackQuestionSourceText {
  questionIndex: number;
  questionId: string;
  recommendationText?: string;
  improvementText?: string;
}

const USABLE_QUESTION_SOURCE_STATES = new Set([
  'accepted',
  'edited',
  'generated',
]);

export function resolveCandidateFeedbackQuestionSourceText(
  question: CandidateFeedbackQuestion,
): CandidateFeedbackQuestionSourceText | null {
  if (!USABLE_QUESTION_SOURCE_STATES.has(question.state)) {
    return null;
  }

  const recommendationText = question.recommendationText?.trim() || undefined;
  const improvementText = question.improvementText?.trim() || undefined;
  if (!recommendationText && !improvementText) {
    return null;
  }

  return {
    questionIndex: question.questionIndex,
    questionId: question.questionId,
    recommendationText,
    improvementText,
  };
}

export function collectCandidateFeedbackQuestionSourceTexts(
  questions: CandidateFeedbackQuestion[],
): CandidateFeedbackQuestionSourceText[] {
  return questions
    .map((question) => resolveCandidateFeedbackQuestionSourceText(question))
    .filter(
      (item): item is CandidateFeedbackQuestionSourceText => item !== null,
    )
    .sort((left, right) => left.questionIndex - right.questionIndex);
}
