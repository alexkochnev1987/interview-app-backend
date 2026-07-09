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
  questions: CandidateFeedbackQuestion[];
  createdAt: Date;
  updatedAt: Date;
}
