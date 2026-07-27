import {
  CandidateFeedback,
  CandidateFeedbackQuestion,
} from './interfaces/candidate-feedback.interface';
import {
  CandidateFeedbackBlockDto,
  CandidateFeedbackQuestionBlockDto,
  CandidateFeedbackResponseDto,
} from './dto/candidate-feedback.responses.dto';

function presentBlock(
  recommendationText: string | undefined,
  improvementText: string | undefined,
  state: CandidateFeedback['overallState'],
  errorMessage: string | undefined,
): CandidateFeedbackBlockDto {
  return {
    recommendationText,
    improvementText,
    state,
    errorMessage,
  };
}

export function presentCandidateFeedbackQuestionBlock(
  question: CandidateFeedbackQuestion,
): CandidateFeedbackQuestionBlockDto {
  return {
    questionIndex: question.questionIndex,
    questionId: question.questionId,
    ...presentBlock(
      question.recommendationText,
      question.improvementText,
      question.state,
      question.errorMessage,
    ),
  };
}

export function presentCandidateFeedback(
  feedback: CandidateFeedback,
): CandidateFeedbackResponseDto {
  const response: CandidateFeedbackResponseDto = {
    interviewId: feedback.interviewId,
    overall: presentBlock(
      feedback.overallRecommendationText,
      feedback.overallImprovementText,
      feedback.overallState,
      feedback.overallErrorMessage,
    ),
    questions: feedback.questions.map((question) =>
      presentCandidateFeedbackQuestionBlock(question),
    ),
    updatedAt: feedback.updatedAt.toISOString(),
  };

  if (feedback.outcome) {
    response.outcome = feedback.outcome;
  }

  if (feedback.outcome === 'custom' && feedback.outcomeMessage) {
    response.outcomeMessage = feedback.outcomeMessage;
  }

  return response;
}
