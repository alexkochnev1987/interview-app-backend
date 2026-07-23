export const CANDIDATE_FEEDBACK_BLOCK_STATES = [
  'not_generated',
  'generating',
  'generated',
  'accepted',
  'edited',
  'failed',
] as const;

export type CandidateFeedbackBlockState =
  (typeof CANDIDATE_FEEDBACK_BLOCK_STATES)[number];

/** Candidate-facing next-step message shown on the public share page. */
export const CANDIDATE_FEEDBACK_OUTCOMES = [
  'next_stage',
  'keep_in_touch',
  'custom',
] as const;

export type CandidateFeedbackOutcome =
  (typeof CANDIDATE_FEEDBACK_OUTCOMES)[number];

export const CANDIDATE_FEEDBACK_PRESET_OUTCOMES = [
  'next_stage',
  'keep_in_touch',
] as const;

export type CandidateFeedbackPresetOutcome =
  (typeof CANDIDATE_FEEDBACK_PRESET_OUTCOMES)[number];

export function isCandidateFeedbackPresetOutcome(
  outcome: CandidateFeedbackOutcome,
): outcome is CandidateFeedbackPresetOutcome {
  return outcome === 'next_stage' || outcome === 'keep_in_touch';
}
export interface CandidateFeedbackQuestion {
  id: string;
  candidateFeedbackId: string;
  questionIndex: number;
  questionId: string;
  recommendationText?: string;
  improvementText?: string;
  state: CandidateFeedbackBlockState;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateFeedback {
  id: string;
  interviewId: string;
  overallRecommendationText?: string;
  overallImprovementText?: string;
  overallState: CandidateFeedbackBlockState;
  overallErrorMessage?: string;
  /** Whether the candidate advances; drives the public share message. */
  outcome?: CandidateFeedbackOutcome;
  /** Required for `custom` outcome; cleared for presets. */
  outcomeMessage?: string;
  questions: CandidateFeedbackQuestion[];
  createdAt: Date;
  updatedAt: Date;
}
