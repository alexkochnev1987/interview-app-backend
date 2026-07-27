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
import { Interview } from '../interview/interfaces/interview.interface';
import { Locale } from '../locale/locale.constants';

function resolveSnapshotQuestionText(
  interview: Interview,
  question: CandidateFeedbackQuestion,
): string | undefined {
  const byIndex = interview.questions[question.questionIndex];
  if (byIndex?.id === question.questionId) {
    const text = byIndex.questionText?.trim();
    if (text) {
      return text;
    }
  }

  const byId = interview.questions.find(
    (item) => item.id === question.questionId,
  );
  const fallbackText = byId?.questionText?.trim();
  return fallbackText || undefined;
}

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
  interview?: Interview,
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

    const block: PublicCandidateFeedbackQuestionBlock = {
      questionIndex: question.questionIndex,
      questionId: question.questionId,
      ...texts,
    };

    if (interview) {
      const questionText = resolveSnapshotQuestionText(interview, question);
      if (questionText) {
        block.questionText = questionText;
      }
    }

    published.push(block);
  }

  return published;
}

export function presentPublicCandidateFeedback(
  feedback: CandidateFeedback,
  meta: {
    interviewLocale: Locale;
    position: string;
    expiresAt: Date;
    overallScore?: number;
    interview?: Interview;
  },
): PublicCandidateFeedbackResponse {
  const response: PublicCandidateFeedbackResponse = {
    interviewLocale: meta.interviewLocale,
    position: meta.position,
    expiresAt: meta.expiresAt.toISOString(),
  };

  const completedAt = meta.interview?.result?.completedAt;
  if (completedAt) {
    response.interviewDate = completedAt.toISOString();
  }

  if (meta.overallScore != null) {
    response.overallScore = meta.overallScore;
  }

  if (feedback.outcome) {
    response.outcome = feedback.outcome;
  }

  if (feedback.outcome === 'custom' && feedback.outcomeMessage) {
    response.outcomeMessage = feedback.outcomeMessage;
  }

  const overall = filterPublishableOverall(feedback);
  if (overall) {
    response.overall = overall;
  }

  const questions = filterPublishableQuestions(
    feedback.questions,
    meta.interview,
  );
  if (questions.length > 0) {
    response.questions = questions;
  }

  return response;
}
