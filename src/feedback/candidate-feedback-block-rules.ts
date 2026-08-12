import { isQuestionFeedbackEligibilitySkipReason } from './candidate-feedback-eligibility';
import { CandidateFeedbackBlockState } from './interfaces/candidate-feedback.interface';

export const PROTECTED_CANDIDATE_FEEDBACK_BLOCK_STATES = [
  'accepted',
  'edited',
] as const satisfies readonly CandidateFeedbackBlockState[];

export const HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES = [
  'accepted',
  'edited',
] as const satisfies readonly CandidateFeedbackBlockState[];

export type HrPatchableCandidateFeedbackBlockState =
  (typeof HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES)[number];

export const CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH = 10_000;

export function resolveHrPatchFeedbackText(
  existing: {
    recommendationText?: string;
    improvementText?: string;
  },
  patch: {
    recommendationText?: string;
    improvementText?: string;
  },
): {
  recommendationText?: string;
  improvementText?: string;
} {
  return {
    recommendationText:
      patch.recommendationText !== undefined
        ? patch.recommendationText
        : existing.recommendationText,
    improvementText:
      patch.improvementText !== undefined
        ? patch.improvementText
        : existing.improvementText,
  };
}

export function hasPublishableCandidateFeedbackText(texts: {
  recommendationText?: string;
  improvementText?: string;
}): boolean {
  return Boolean(
    texts.recommendationText?.trim() || texts.improvementText?.trim(),
  );
}

export function isCandidateFeedbackBlockProtected(
  state: CandidateFeedbackBlockState,
): boolean {
  return (
    PROTECTED_CANDIDATE_FEEDBACK_BLOCK_STATES as readonly string[]
  ).includes(state);
}

export function canRegenerateCandidateFeedbackBlock(
  state: CandidateFeedbackBlockState,
  context?: { errorMessage?: string | null },
): boolean {
  return getRegenerationBlockReason(state, context) === null;
}

export type CandidateFeedbackRegenerationBlockReason = 'locked' | 'in_progress';

export function getRegenerationBlockReason(
  state: CandidateFeedbackBlockState,
  context?: { errorMessage?: string | null },
): CandidateFeedbackRegenerationBlockReason | null {
  if (isCandidateFeedbackBlockProtected(state)) {
    const skipHint = context?.errorMessage?.trim();
    if (
      state === 'edited' &&
      skipHint &&
      isQuestionFeedbackEligibilitySkipReason(skipHint)
    ) {
      return null;
    }
    return 'locked';
  }
  if (state === 'generating') {
    return 'in_progress';
  }
  return null;
}

export function getHrPatchBlockReason(
  state: CandidateFeedbackBlockState,
): 'in_progress' | null {
  if (state === 'generating') {
    return 'in_progress';
  }
  return null;
}

export function isHrPatchableCandidateFeedbackBlockState(
  state: string,
): state is HrPatchableCandidateFeedbackBlockState {
  return (
    HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES as readonly string[]
  ).includes(state);
}
