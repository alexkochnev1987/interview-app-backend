import { ApiExtraModels, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import { QuestionDifficulty } from '../interfaces/question.interface';
import { QuestionTranslationsMapDto } from './question-translations-map.dto';
import { OUTPUT_LANGUAGE_OPENAPI_NOTE } from './openapi-deprecation';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question-rubric.dto';

@ApiExtraModels(QuestionExpectedConceptDto, QuestionRedFlagDto)
export class QuestionDraftInputDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  primaryLocale?: Locale;

  @ApiPropertyOptional({
    type: QuestionTranslationsMapDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionTranslationsMapDto)
  translations?: QuestionTranslationsMapDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  followUpQuestions?: string[];

  @ApiPropertyOptional({
    type: 'array',
    items: { $ref: getSchemaPath(QuestionExpectedConceptDto) },
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionExpectedConceptDto)
  expectedConcepts?: QuestionExpectedConceptDto[];

  @ApiPropertyOptional({
    type: 'array',
    items: { $ref: getSchemaPath(QuestionRedFlagDto) },
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionRedFlagDto)
  redFlags?: QuestionRedFlagDto[];

  @ApiPropertyOptional({
    deprecated: true,
    description: OUTPUT_LANGUAGE_OPENAPI_NOTE,
  })
  @IsOptional()
  @IsString()
  outputLanguage?: string;

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
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcategory?: string;

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
