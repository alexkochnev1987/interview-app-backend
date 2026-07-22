import {
  hasPublishableCandidateFeedbackText,
  isCandidateFeedbackBlockProtected,
} from './candidate-feedback-block-rules';
import {
  CandidateFeedback,
  CandidateFeedbackBlockState,
  CandidateFeedbackQuestion,
} from './interfaces/candidate-feedback.interface';
import {
  PublicCandidateFeedbackQuestionBlock,
  PublicCandidateFeedbackResponse,
  PublicCandidateFeedbackTextBlock,
} from './interfaces/candidate-feedback-share-link.interface';
import { Locale } from '../locale/locale.constants';

export function isPublishableCandidateFeedbackBlock(
  state: CandidateFeedbackBlockState,
  texts: {
    recommendationText?: string;
    improvementText?: string;
  },
): boolean {
  return (
    isCandidateFeedbackBlockProtected(state) &&
    hasPublishableCandidateFeedbackText(texts)
  );
}

export function hasAnyPublishableCandidateFeedbackBlock(
  feedback: CandidateFeedback,
): boolean {
  if (
    isPublishableCandidateFeedbackBlock(feedback.overallState, {
      recommendationText: feedback.overallRecommendationText,
      improvementText: feedback.overallImprovementText,
    })
  ) {
    return true;
  }

  return feedback.questions.some((question) =>
    isPublishableCandidateFeedbackBlock(question.state, {
      recommendationText: question.recommendationText,
      improvementText: question.improvementText,
    }),
  );
}

function presentPublishableTextBlock(texts: {
  recommendationText?: string;
  improvementText?: string;
}): PublicCandidateFeedbackTextBlock | undefined {
  if (!hasPublishableCandidateFeedbackText(texts)) {
    return undefined;
  }

  const block: PublicCandidateFeedbackTextBlock = {};
  const recommendation = texts.recommendationText?.trim();
  const improvement = texts.improvementText?.trim();
  if (recommendation) {
    block.recommendationText = recommendation;
  }
  if (improvement) {
    block.improvementText = improvement;
  }
  return block;
}

export function filterPublishableOverall(
  feedback: CandidateFeedback,
): PublicCandidateFeedbackTextBlock | undefined {
  if (
    !isPublishableCandidateFeedbackBlock(feedback.overallState, {
      recommendationText: feedback.overallRecommendationText,
      improvementText: feedback.overallImprovementText,
    })
  ) {
    return undefined;
  }

  return presentPublishableTextBlock({
    recommendationText: feedback.overallRecommendationText,
    improvementText: feedback.overallImprovementText,
  });
}

export function filterPublishableQuestions(
  questions: CandidateFeedbackQuestion[],
): PublicCandidateFeedbackQuestionBlock[] {
  const published: PublicCandidateFeedbackQuestionBlock[] = [];

  for (const question of questions) {
    if (
      !isPublishableCandidateFeedbackBlock(question.state, {
        recommendationText: question.recommendationText,
        improvementText: question.improvementText,
      })
    ) {
      continue;
    }

    const texts = presentPublishableTextBlock({
      recommendationText: question.recommendationText,
      improvementText: question.improvementText,
    });
    if (!texts) {
      continue;
    }

    published.push({
      questionIndex: question.questionIndex,
      questionId: question.questionId,
      ...texts,
    });
  }

  return published;
}

export function presentPublicCandidateFeedback(
  feedback: CandidateFeedback,
  meta: {
    interviewLocale: Locale;
    position: string;
    expiresAt: Date;
  },
): PublicCandidateFeedbackResponse {
  const response: PublicCandidateFeedbackResponse = {
    interviewLocale: meta.interviewLocale,
    position: meta.position,
    expiresAt: meta.expiresAt.toISOString(),
  };

  const overall = filterPublishableOverall(feedback);
  if (overall) {
    response.overall = overall;
  }

  const questions = filterPublishableQuestions(feedback.questions);
  if (questions.length > 0) {
    response.questions = questions;
  }

  return response;
}
