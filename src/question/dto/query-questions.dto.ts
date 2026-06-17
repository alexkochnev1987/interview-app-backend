import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import { QuestionDifficulty } from '../interfaces/question.interface';
import { OUTPUT_LANGUAGE_OPENAPI_NOTE } from './openapi-deprecation';

export const QUESTION_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'difficulty',
  'questionText',
  'popularity',
] as const;

export type QuestionSortField = (typeof QUESTION_SORT_FIELDS)[number];

export const QUESTION_SORT_ORDERS = ['asc', 'desc'] as const;
export type QuestionSortOrder = (typeof QUESTION_SORT_ORDERS)[number];

export const QUESTION_STATUS_VALUES = ['active', 'inactive', 'all'] as const;
export type QuestionStatusFilter = (typeof QUESTION_STATUS_VALUES)[number];

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function queryBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return undefined;
}

function csvToArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

export class QueryQuestionsDto {
  @ApiPropertyOptional({ description: 'Free-text search over question text, role, category, subcategory, tags.' })
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ description: 'Subcategory — exposed as the "Type" filter in the picker UI.' })
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(120)
  subcategory?: string;

  @ApiPropertyOptional({ type: [String], description: 'ANY-match: rows whose tags array overlaps the given list. Send as ?tags=react,hooks or repeated.' })
  @IsOptional()
  @Transform(({ value }) => csvToArray(value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(120)
  role?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'Filter by canonical question locale (primary_locale).',
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  primaryLocale?: Locale;

  @ApiPropertyOptional({
    deprecated: true,
    description: OUTPUT_LANGUAGE_OPENAPI_NOTE,
  })
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(60)
  outputLanguage?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description:
      'Filter: `primaryLocale === locale` OR non-empty `translations[locale].questionText`. ' +
      'When set, each list item resolves `questionText` and rubric for this locale (with primary fallback). ' +
      'When omitted, items follow `X-Locale` (default `en`).',
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: Locale;

  @ApiPropertyOptional({ enum: QUESTION_STATUS_VALUES, default: 'active', description: 'Non-super_admin callers are forced to "active" regardless of what they pass.' })
  @IsOptional()
  @IsIn(QUESTION_STATUS_VALUES)
  status?: QuestionStatusFilter;

  @ApiPropertyOptional({ enum: QUESTION_SORT_FIELDS, default: 'updatedAt' })
  @IsOptional()
  @IsIn(QUESTION_SORT_FIELDS)
  sortBy?: QuestionSortField;

  @ApiPropertyOptional({ enum: QUESTION_SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(QUESTION_SORT_ORDERS)
  sortOrder?: QuestionSortOrder;

  @ApiPropertyOptional({
    description:
      'When true, each list item includes the full translations map. Default false.',
  })
  @IsOptional()
  @Transform(({ value }) => queryBoolean(value))
  @IsBoolean()
  includeTranslations?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
