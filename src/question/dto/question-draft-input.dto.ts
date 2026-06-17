import { ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import { QuestionDifficulty } from '../interfaces/question.interface';
import { QuestionTranslationDto } from './question-translation.dto';
import { OUTPUT_LANGUAGE_OPENAPI_NOTE } from './openapi-deprecation';

export class QuestionDraftInputDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  primaryLocale?: Locale;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(QuestionTranslationDto) },
  })
  @IsOptional()
  @IsObject()
  translations?: Partial<Record<Locale, QuestionTranslationDto>>;

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
