import type {
  Interview,
  InterviewDecision,
} from '../interview/interfaces/interview.interface';
import {
  classifyQuestionFeedbackGeneration,
  classifyOverallFeedbackToneMode,
  type OverallFeedbackToneMode,
} from './candidate-feedback-eligibility';
import { isQuestionFeedbackEligibilitySkipReason } from './candidate-feedback-eligibility';
import type { CandidateFeedbackQuestion } from './interfaces/candidate-feedback.interface';

export type ContributingQuestionTone =
  | 'balanced'
  | 'growth_focused'
  | 'honest_weak'
  | 'no_substantive';

export interface OverallInterviewMixMetadata {
  answeredWellCount: number;
  noSubstantiveAnswerCount: number;
  weakAnswerCount: number;
  totalQuestions: number;
}

function isEligibilitySkipTemplateBlock(
  block: Pick<CandidateFeedbackQuestion, 'errorMessage'>,
): boolean {
  const hint = block.errorMessage?.trim();
  return Boolean(hint && isQuestionFeedbackEligibilitySkipReason(hint));
}

function classifyContributingQuestionTone(
  interview: Pick<Interview, 'questions' | 'answers'>,
  block: CandidateFeedbackQuestion,
): ContributingQuestionTone {
  if (isEligibilitySkipTemplateBlock(block)) {
    return 'no_substantive';
  }

  const answer = interview.answers?.find(
    (item) => item.questionIndex === block.questionIndex,
  );
  if (!answer) {
    return 'no_substantive';
  }

  const classification = classifyQuestionFeedbackGeneration(
    interview,
    answer,
    block.questionIndex,
  );
  if (classification.action === 'skip') {
    return 'no_substantive';
  }

  switch (classification.toneMode) {
    case 'honest_weak':
      return 'honest_weak';
    case 'balanced':
      return 'balanced';
    default:
      return 'growth_focused';
  }
}

export function buildOverallInterviewMixMetadata(
  contributions: ContributingQuestionTone[],
): OverallInterviewMixMetadata {
  return {
    answeredWellCount: contributions.filter((tone) => tone === 'balanced')
      .length,
    noSubstantiveAnswerCount: contributions.filter(
      (tone) => tone === 'no_substantive',
    ).length,
    weakAnswerCount: contributions.filter(
      (tone) => tone === 'honest_weak' || tone === 'growth_focused',
    ).length,
    totalQuestions: contributions.length,
  };
}

export function classifyOverallToneFromQuestionBlocks(
  decision: InterviewDecision | undefined,
  contributions: ContributingQuestionTone[],
): OverallFeedbackToneMode {
  if (contributions.length === 0) {
    return classifyOverallFeedbackToneMode(decision);
  }

  if (
    decision === 'reject' ||
    contributions.some((tone) => tone === 'honest_weak')
  ) {
    return 'honest_weak';
  }

  const hasSkipTemplate = contributions.some(
    (tone) => tone === 'no_substantive',
  );
  const weakQuestionCount = contributions.filter(
    (tone) => tone === 'honest_weak' || tone === 'growth_focused',
  ).length;

  if (hasSkipTemplate || weakQuestionCount >= 2 || decision === 'review') {
    return 'growth_focused';
  }

  if (contributions.every((tone) => tone === 'balanced')) {
    return 'balanced';
  }

  return 'growth_focused';
}

export function resolveOverallFeedbackTone(
  interview: Pick<Interview, 'questions' | 'answers' | 'result'>,
  questions: CandidateFeedbackQuestion[],
): {
  toneMode: OverallFeedbackToneMode;
  mixMetadata: OverallInterviewMixMetadata;
} {
  const contributions = [...questions]
    .sort((left, right) => left.questionIndex - right.questionIndex)
    .map((block) => classifyContributingQuestionTone(interview, block));

  return {
    mixMetadata: buildOverallInterviewMixMetadata(contributions),
    toneMode: classifyOverallToneFromQuestionBlocks(
      interview.result?.decision,
      contributions,
    ),
  };
}

export function isMixedInterviewMetadata(
  metadata: OverallInterviewMixMetadata,
): boolean {
  return (
    metadata.noSubstantiveAnswerCount > 0 ||
    metadata.weakAnswerCount > 0 ||
    metadata.answeredWellCount < metadata.totalQuestions
  );
}
