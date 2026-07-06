import { Locale } from '../locale/locale.constants';
import { QuestionDifficulty } from './interfaces/question.interface';
import { QuestionTranslationDto } from './dto/question-translation.dto';
import {
  QuestionExpectedConcept,
  QuestionRedFlag,
} from './interfaces/question.interface';

export type QuestionDraftInput = {
  primaryLocale?: Locale;
  translations?: Partial<Record<Locale, QuestionTranslationDto>>;
  outputLanguage?: string;
  externalId?: string;
  role?: string;
  focus?: string;
  category?: string;
  subcategory?: string;
  questionText?: string;
  followUpQuestions?: string[];
  expectedConcepts?: Array<string | Partial<QuestionExpectedConcept>>;
  redFlags?: Array<string | Partial<QuestionRedFlag>>;
  difficulty?: QuestionDifficulty;
  weight?: number;
  sampleGoodAnswer?: string;
  minimumPassScore?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
};
