import { Locale } from '../locale/locale.constants';
import {
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../question/interfaces/question.interface';

/** Locale rubric block returned by POST /questions/ai/draft `mode=generate|translate`. */
export interface QuestionDraftContent {
  primaryLocale: Locale;
  questionText: string;
  followUpQuestions: string[];
  expectedConcepts: QuestionExpectedConcept[];
  redFlags: QuestionRedFlag[];
  sampleGoodAnswer: string;
}
