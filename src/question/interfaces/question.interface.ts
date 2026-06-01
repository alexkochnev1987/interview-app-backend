import { Locale } from '../../locale/locale.constants';

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

export interface QuestionTranslation {
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  sampleGoodAnswer?: string;
}

export type QuestionTranslations = Partial<Record<Locale, QuestionTranslation>>;

export interface QuestionCore {
  id: string;
  externalId?: string;
  role?: string;
  focus?: string;
  primaryLocale: Locale;
  translations: QuestionTranslations;
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
}

export type QuestionDraft = Omit<QuestionCore, 'id'>;

export type SimilarQuestionResolved = Omit<Question, 'translations'> & {
  resolvedLocale: Locale;
  availableLocales: Locale[];
  translations?: QuestionTranslations;
};

export interface SimilarQuestionMatch {
  question: SimilarQuestionResolved;
  score: number;
  reasons: string[];
}
