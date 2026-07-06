import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import { QuestionDifficulty } from '../interfaces/question.interface';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question.responses.dto';
import { QuestionTranslationDto } from './question-translation.dto';
import {
  QuestionTranslationsMapDto,
} from './question-translations-map.dto';
import { QuestionTranslationsMapConstraint } from './validators/question-translations.validator';
import { OUTPUT_LANGUAGE_OPENAPI_NOTE } from './openapi-deprecation';

@ApiExtraModels(
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
  QuestionTranslationDto,
  QuestionTranslationsMapDto,
)
export class CreateQuestionDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES, required: true })
  @IsDefined({ message: 'primaryLocale is required (en, be, ru, or pl)' })
  @IsIn([...SUPPORTED_LOCALES])
  primaryLocale: Locale;

  @ApiProperty({
    required: true,
    type: QuestionTranslationsMapDto,
    description:
      'Locale-keyed rubric blocks. The primaryLocale entry must include all five fields: ' +
      'questionText, followUpQuestions, expectedConcepts, redFlags, sampleGoodAnswer. ' +
      'Additional locales require questionText only; rubric fields are optional.',
  })
  @IsDefined({ message: 'translations is required' })
  @ValidateNested()
  @Type(() => QuestionTranslationsMapDto)
  @Validate(QuestionTranslationsMapConstraint)
  translations: QuestionTranslationsMapDto;

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

  @ApiPropertyOptional({
    deprecated: true,
    description: `Ignored when translations are provided. ${OUTPUT_LANGUAGE_OPENAPI_NOTE}`,
  })
  @IsOptional()
  @IsString()
  outputLanguage?: string;

  @ApiPropertyOptional({
    description:
      'Flat question metadata — stored on the question row, not inside translations.',
  })
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
