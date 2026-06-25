export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionRedFlagSeverity = 'low' | 'medium' | 'high';

export interface QuestionExpectedConcept {
  id: string;
  label: string;
  weight: number;
  description: string;
}

export interface QuestionRedFlag {
  id: string;
  label: string;
  severity: QuestionRedFlagSeverity;
}

export interface QuestionCore {
  id: string;
  externalId?: string;
  role?: string;
  focus?: string;
  outputLanguage: string;
  category?: string;
  subcategory?: string;
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  difficulty: QuestionDifficulty;
  weight: number;
  sampleGoodAnswer?: string;
  minimumPassScore: number;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface Question extends QuestionCore {
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  usageCount: number;
  pendingDeletion: boolean;
  blockingInterviews?: QuestionDeleteBlockingInterview[];
}

export interface QuestionDeleteBlockingInterview {
  id: string;
  candidateName: string;
  href: string;
}

export interface QuestionDeleteScheduledItem {
  id: string;
  questionText: string;
  reason: string;
  blockingInterviews: QuestionDeleteBlockingInterview[];
}

export type SoftDeleteQuestionResult =
  | { id: string; deleted: true }
  | {
      id: string;
      scheduled: true;
      blockingInterviews: QuestionDeleteBlockingInterview[];
    };

export type QuestionDraft = Omit<QuestionCore, 'id'>;

export interface SimilarQuestionMatch {
  question: Question;
  score: number;
  reasons: string[];
}
