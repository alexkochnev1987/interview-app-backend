import {
  ApiExtraModels,
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
  Validate,
} from 'class-validator';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import {
  QuestionDifficulty,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../interfaces/question.interface';
import { QuestionTranslationsMode } from '../question-translations-update';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question.responses.dto';
import { QuestionTranslationDto } from './question-translation.dto';
import { QuestionTranslationsUpdateMapConstraint } from './validators/question-translations.validator';
import { OUTPUT_LANGUAGE_OPENAPI_NOTE } from './openapi-deprecation';

@ApiExtraModels(QuestionExpectedConceptDto, QuestionRedFlagDto, QuestionTranslationDto)
export class UpdateQuestionDto {
  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    deprecated: true,
    description:
      'Ignored on update — primaryLocale is immutable after creation. ' +
      'Update the primary locale block via `translations[primaryLocale]` instead.',
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  primaryLocale?: Locale;

  @ApiPropertyOptional({
    enum: ['merge', 'replace'],
    default: 'merge',
    description:
      'How to apply `translations`. Default `merge` upserts each locale key. ' +
      'Set to `replace` to replace the entire stored map (requires `translations`).',
  })
  @IsOptional()
  @IsIn(['merge', 'replace'])
  translationsMode?: QuestionTranslationsMode;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(QuestionTranslationDto) },
    description:
      'Locale blocks to merge or replace. primaryLocale must remain a full block; non-primary locales require questionText only and may omit rubric fields.',
  })
  @IsOptional()
  @IsObject()
  @Validate(QuestionTranslationsUpdateMapConstraint)
  translations?: Partial<Record<Locale, QuestionTranslationDto>>;

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
    description: `Ignored when primaryLocale or translations are set. ${OUTPUT_LANGUAGE_OPENAPI_NOTE}`,
  })
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

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Updates the primary locale block when translations are omitted (legacy partial update).',
  })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  questionText?: string;

  @ApiPropertyOptional({ type: [String], deprecated: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  followUpQuestions?: string[];

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsArray()
  expectedConcepts?: Array<string | Partial<QuestionExpectedConcept>>;

  @ApiPropertyOptional({ deprecated: true })
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

  @ApiPropertyOptional({ deprecated: true })
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
