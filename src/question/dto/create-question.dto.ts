import { QuestionDifficulty } from '../interfaces/question.interface';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question.responses.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuestionDto {
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

  @ApiProperty()
  questionText: string;

  @ApiPropertyOptional({ type: [String] })
  followUpQuestions?: string[];

  @ApiPropertyOptional({ type: [QuestionExpectedConceptDto] })
  expectedConcepts?: QuestionExpectedConceptDto[];

  @ApiPropertyOptional({ type: [QuestionRedFlagDto] })
  redFlags?: QuestionRedFlagDto[];

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
