import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import {
  QuestionDifficulty,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../interfaces/question.interface';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question.responses.dto';

@ApiExtraModels(QuestionExpectedConceptDto, QuestionRedFlagDto)
export class CreateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  focus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outputLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcategory?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 5000)
  questionText: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  followUpQuestions?: string[];

  @ApiPropertyOptional({
    type: 'array',
    items: {
      oneOf: [
        { type: 'string' },
        { $ref: getSchemaPath(QuestionExpectedConceptDto) },
      ],
    },
  })
  @IsOptional()
  @IsArray()
  expectedConcepts?: Array<string | Partial<QuestionExpectedConcept>>;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      oneOf: [
        { type: 'string' },
        { $ref: getSchemaPath(QuestionRedFlagDto) },
      ],
    },
  })
  @IsOptional()
  @IsArray()
  redFlags?: Array<string | Partial<QuestionRedFlag>>;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sampleGoodAnswer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumPassScore?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
