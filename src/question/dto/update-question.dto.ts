import {
  QuestionDifficulty,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../interfaces/question.interface';

export class UpdateQuestionDto {
  externalId?: string;
  role?: string;
  focus?: string;
  outputLanguage?: string;
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
}
