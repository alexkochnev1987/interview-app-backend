import { Locale } from '../../locale/locale.constants';
import type { CandidateFeedbackOutcome } from './candidate-feedback.interface';

export interface CandidateFeedbackShareLink {
  id: string;
  interviewId: string;
  createdById?: string;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface PublicCandidateFeedbackTextBlock {
  recommendationText?: string;
  improvementText?: string;
}

export interface PublicCandidateFeedbackQuestionBlock extends PublicCandidateFeedbackTextBlock {
  questionIndex: number;
  questionId: string;
  /** Interview question snapshot text in interview locale when available. */
  questionText?: string;
}

/** Public share payload: publishable texts only; empty sections omitted. */
export interface PublicCandidateFeedbackResponse {
  interviewLocale: Locale;
  position: string;
  expiresAt: string;
  /** When the interview was completed (take date), when a result exists. */
  interviewDate?: string;
  /** Present when the interview has a computed result with an overall score. */
  overallScore?: number;
  /**
   * Candidate-facing next-step outcome when HR selected one.
   * Preset copy is rendered client-side from this value; `custom` uses outcomeMessage.
   */
  outcome?: CandidateFeedbackOutcome;
  /** Present only when outcome is `custom`. */
  outcomeMessage?: string;
  overall?: PublicCandidateFeedbackTextBlock;
  questions?: PublicCandidateFeedbackQuestionBlock[];
}
