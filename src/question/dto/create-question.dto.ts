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
  Min,
  Validate,
} from 'class-validator';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import { QuestionDifficulty } from '../interfaces/question.interface';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question.responses.dto';
import { QuestionTranslationDto } from './question-translation.dto';
import { QuestionTranslationsMapConstraint } from './validators/question-translations.validator';

@ApiExtraModels(
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
  QuestionTranslationDto,
)
export class CreateQuestionDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES, required: true })
  @IsIn([...SUPPORTED_LOCALES])
  primaryLocale: Locale;

  @ApiProperty({
    required: true,
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(QuestionTranslationDto) },
    description:
      'Locale-keyed translation blocks. primaryLocale entry must be a full block (questionText + followUpQuestions + expectedConcepts + redFlags + sampleGoodAnswer). ' +
      'Other locales require questionText only; rubric fields are optional.',
  })
  @IsObject()
  @Validate(QuestionTranslationsMapConstraint)
  translations: Partial<Record<Locale, QuestionTranslationDto>>;

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
    description: 'Derived from primaryLocale; ignored when translations are provided.',
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
