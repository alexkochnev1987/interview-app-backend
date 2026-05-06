import {
  QuestionDifficulty,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../interfaces/question.interface';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  externalId?: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  focus?: string;

  @ApiPropertyOptional()
  outputLanguage?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  subcategory?: string;

  @ApiPropertyOptional()
  questionText?: string;

  @ApiPropertyOptional({ type: [String] })
  followUpQuestions?: string[];

  @ApiPropertyOptional({ type: [Object] })
  expectedConcepts?: Array<string | Partial<QuestionExpectedConcept>>;

  @ApiPropertyOptional({ type: [Object] })
  redFlags?: Array<string | Partial<QuestionRedFlag>>;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional()
  weight?: number;

  @ApiPropertyOptional()
  sampleGoodAnswer?: string;

  @ApiPropertyOptional()
  minimumPassScore?: number;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown>;
}
