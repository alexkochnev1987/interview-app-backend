export interface FeedbackLink {
  id: string;
  interviewId: string;
  createdById?: string;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface FeedbackResponse {
  position: string;
  date: string;
  expiresAt: string;
  overallResult?: 'pass' | 'borderline' | 'fail';
  overallScore?: number;
  categoryScores?: Record<string, number>;
  generalFeedback?: string;
  improvements?: string;
}
