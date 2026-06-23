import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import { QuestionTranslations } from '../interfaces/question.interface';
import { OUTPUT_LANGUAGE_OPENAPI_NOTE } from './openapi-deprecation';
import { QuestionTranslationDto } from './question-translation.dto';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question-rubric.dto';

export {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question-rubric.dto';

@ApiExtraModels(QuestionTranslationDto)
export class QuestionResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  primaryLocale?: Locale;

  @ApiPropertyOptional()
  externalId?: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  focus?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: `Legacy display label derived from primaryLocale. ${OUTPUT_LANGUAGE_OPENAPI_NOTE}`,
  })
  outputLanguage?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(QuestionTranslationDto) },
    description:
      'Locale-keyed rubric blocks (`Record<locale, QuestionTranslationDto>`). ' +
      'Included by default on GET /questions/:id; on list GET when `?includeTranslations=true`; always on POST/PUT/PATCH responses.',
  })
  translations?: QuestionTranslations;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  subcategory?: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ type: [String] })
  followUpQuestions: string[];

  @ApiProperty({ type: [QuestionExpectedConceptDto] })
  expectedConcepts: QuestionExpectedConceptDto[];

  @ApiProperty({ type: [QuestionRedFlagDto] })
  redFlags: QuestionRedFlagDto[];

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty()
  weight: number;

  @ApiPropertyOptional()
  sampleGoodAnswer?: string;

  @ApiProperty()
  minimumPassScore: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deleted: boolean;

  @ApiProperty({ description: 'Number of times this question has been used in an interview.' })
  usageCount: number;
}

export class ResolvedQuestionResponseDto extends QuestionResponseDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES })
  declare primaryLocale: Locale;

  @ApiProperty({ enum: SUPPORTED_LOCALES })
  resolvedLocale: Locale;

  @ApiProperty({ enum: SUPPORTED_LOCALES, isArray: true })
  availableLocales: Locale[];

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'Present when resolvedLocale differs from the requested X-Locale.',
  })
  fallbackFromLocale?: Locale;
}

export class PaginatedQuestionsResponseDto {
  @ApiProperty({ type: [ResolvedQuestionResponseDto] })
  items: ResolvedQuestionResponseDto[];

  @ApiProperty({ description: 'Total rows matching the filter, ignoring page/limit.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class QuestionDraftContentResponseDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES })
  primaryLocale: Locale;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ type: [String] })
  followUpQuestions: string[];

  @ApiProperty({ type: [QuestionExpectedConceptDto] })
  expectedConcepts: QuestionExpectedConceptDto[];

  @ApiProperty({ type: [QuestionRedFlagDto] })
  redFlags: QuestionRedFlagDto[];

  @ApiProperty()
  sampleGoodAnswer: string;
}

/** `mode=generate` — identity + rubric; HR sets primaryLocale separately. */
export class QuestionDraftGenerateResponseDto {
  @ApiPropertyOptional()
  externalId?: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  focus?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  subcategory?: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ type: [String] })
  followUpQuestions: string[];

  @ApiProperty({ type: [QuestionExpectedConceptDto] })
  expectedConcepts: QuestionExpectedConceptDto[];

  @ApiProperty({ type: [QuestionRedFlagDto] })
  redFlags: QuestionRedFlagDto[];

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty()
  weight: number;

  @ApiProperty()
  sampleGoodAnswer: string;

  @ApiProperty()
  minimumPassScore: number;

  @ApiProperty({ type: [String] })
  tags: string[];
}

export class QuestionDraftResponseDto {
  @ApiPropertyOptional()
  externalId?: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  focus?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'Locale used for generation (body `locale` or `X-Locale`).',
  })
  primaryLocale?: Locale;

  @ApiPropertyOptional({
    deprecated: true,
    description: OUTPUT_LANGUAGE_OPENAPI_NOTE,
  })
  outputLanguage?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  subcategory?: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ type: [String] })
  followUpQuestions: string[];

  @ApiProperty({ type: [QuestionExpectedConceptDto] })
  expectedConcepts: QuestionExpectedConceptDto[];

  @ApiProperty({ type: [QuestionRedFlagDto] })
  redFlags: QuestionRedFlagDto[];

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty()
  weight: number;

  @ApiPropertyOptional()
  sampleGoodAnswer?: string;

  @ApiProperty()
  minimumPassScore: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata: Record<string, unknown>;
}

export class DeleteQuestionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: true })
  deleted: true;
}

export class BulkDeleteBlockedItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty()
  reason: string;
}

export class BulkDeleteQuestionsResponseDto {
  @ApiProperty({ type: [String] })
  deleted: string[];

  @ApiProperty({ type: [BulkDeleteBlockedItemDto] })
  blocked: BulkDeleteBlockedItemDto[];
}

export class SimilarQuestionMatchDto {
  @ApiProperty({ type: ResolvedQuestionResponseDto })
  question: ResolvedQuestionResponseDto;

  @ApiProperty()
  score: number;

  @ApiProperty({ type: [String] })
  reasons: string[];
}

export class FindSimilarResponseDto {
  @ApiProperty({ type: [SimilarQuestionMatchDto] })
  matches: SimilarQuestionMatchDto[];
}

export class FacetCountDto {
  @ApiProperty()
  value: string;

  @ApiProperty({ description: 'Number of active questions with this value, given the rest of the current filters.' })
  count: number;
}

export class QuestionFacetsResponseDto {
  @ApiProperty({
    type: [FacetCountDto],
    description: 'Difficulty value + count, given all OTHER current filters (difficulty itself is not applied).',
  })
  difficulties: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Category value + count, given all OTHER current filters (category itself is not applied).',
  })
  categories: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Subcategory value + count, given all OTHER current filters (subcategory itself is not applied). Exposed as the "Type" facet in the picker.',
  })
  subcategories: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Role value + count, given all OTHER current filters (role itself is not applied).',
  })
  roles: FacetCountDto[];

  @ApiProperty({
    type: [FacetCountDto],
    description: 'Tag value + count, given all OTHER current filters (tag overlap is not applied).',
  })
  tags: FacetCountDto[];
}
