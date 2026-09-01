import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { ASSIGNED_HR_FILTER_UNASSIGNED } from '../assigned-hr-filter';
import {
  INTERVIEW_STATUSES,
  InterviewStatus,
} from '../interfaces/interview.interface';
import { parseBooleanQuery } from './list-interviews-query.dto';

export const INTERVIEW_SORT_FIELDS = [
  'candidateName',
  'createdAt',
  'updatedAt',
] as const;

export type InterviewSortField = (typeof INTERVIEW_SORT_FIELDS)[number];

export const INTERVIEW_SORT_ORDERS = ['asc', 'desc'] as const;
export type InterviewSortOrder = (typeof INTERVIEW_SORT_ORDERS)[number];

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class InterviewListFiltersDto {
  @ApiPropertyOptional({ description: 'Search by candidates name' })
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value)?.toLowerCase())
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by position (exact match)' })
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(120)
  position?: string;

  @ApiPropertyOptional({ enum: INTERVIEW_STATUSES })
  @IsOptional()
  @IsIn([...INTERVIEW_STATUSES])
  status?: InterviewStatus;

  @ApiPropertyOptional({
    description:
      'Filter by assigned HR reviewer UUID, or the literal `unassigned` for interviews with no assignee.',
    type: String,
    examples: {
      byHr: { value: '00000000-0000-4000-8000-000000000001' },
      unassigned: { value: ASSIGNED_HR_FILTER_UNASSIGNED },
    },
  })
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value))
  @ValidateIf((o) => o.assignedHrId === ASSIGNED_HR_FILTER_UNASSIGNED)
  @IsIn([ASSIGNED_HR_FILTER_UNASSIGNED])
  @ValidateIf((o) => o.assignedHrId !== ASSIGNED_HR_FILTER_UNASSIGNED)
  @IsUUID()
  assignedHrId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by registered candidate account email (exact match, case-insensitive).',
  })
  @IsOptional()
  @Transform(({ value }) => trimToUndefined(value)?.toLowerCase())
  @IsEmail()
  candidateEmail?: string;
}

export class QueryInterviewsDto extends InterviewListFiltersDto {
  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Deprecated legacy flag from the pre-filter list API. Accepted for backward compatibility but ignored; this endpoint always returns a paginated { items, total, page, limit } envelope.',
  })
  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value))
  @IsBoolean()
  paginated?: boolean;

  @ApiPropertyOptional({ enum: INTERVIEW_SORT_FIELDS, default: 'updatedAt' })
  @IsOptional()
  @IsIn([...INTERVIEW_SORT_FIELDS])
  sortBy?: InterviewSortField;

  @ApiPropertyOptional({ enum: INTERVIEW_SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn([...INTERVIEW_SORT_ORDERS])
  sortOrder?: InterviewSortOrder;

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
