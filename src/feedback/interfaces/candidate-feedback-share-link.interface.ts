import { Locale } from '../../locale/locale.constants';

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

export interface PublicCandidateFeedbackQuestionBlock
  extends PublicCandidateFeedbackTextBlock {
  questionIndex: number;
  questionId: string;
}

/** Public share payload: publishable texts only; empty sections omitted. */
export interface PublicCandidateFeedbackResponse {
  interviewLocale: Locale;
  position: string;
  expiresAt: string;
  overall?: PublicCandidateFeedbackTextBlock;
  questions?: PublicCandidateFeedbackQuestionBlock[];
}
