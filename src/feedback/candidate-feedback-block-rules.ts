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

export function isCandidateFeedbackBlockProtected(
  state: CandidateFeedbackBlockState,
): boolean {
  return (PROTECTED_CANDIDATE_FEEDBACK_BLOCK_STATES as readonly string[]).includes(
    state,
  );
}

export function canRegenerateCandidateFeedbackBlock(
  state: CandidateFeedbackBlockState,
): boolean {
  return getRegenerationBlockReason(state) === null;
}

export type CandidateFeedbackRegenerationBlockReason = 'locked' | 'in_progress';

export function getRegenerationBlockReason(
  state: CandidateFeedbackBlockState,
): CandidateFeedbackRegenerationBlockReason | null {
  if (isCandidateFeedbackBlockProtected(state)) {
    return 'locked';
  }
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
