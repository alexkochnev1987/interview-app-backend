import { Locale } from '../locale/locale.constants';
import {
  QuestionDifficulty,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../question/interfaces/question.interface';

/** Locale rubric block returned by POST /questions/ai/draft `mode=translate`. */
export interface QuestionDraftContent {
  primaryLocale: Locale;
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  sampleGoodAnswer: string;
}

/** Full AI generate draft: identity + rubric (no primaryLocale, metadata, or outputLanguage). */
export interface QuestionDraftGenerate {
  externalId?: string;
  role?: string;
  focus?: string;
  category?: string;
  subcategory?: string;
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  difficulty: QuestionDifficulty;
  weight: number;
  sampleGoodAnswer: string;
  minimumPassScore: number;
  tags: string[];
}
