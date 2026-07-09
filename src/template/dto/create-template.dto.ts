import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Upper bound on a template's question set; keeps the JSONB column and the
// batch resolve query from being bloated by an unbounded array.
export const MAX_TEMPLATE_QUESTIONS = 100;

export class CreateTemplateDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(0, 200)
  position?: string;

  @ApiProperty({
    type: [String],
    description:
      'Ordered question ids. Stored as live references and resolved to current ' +
      'questions on read; at least one is required (empty templates are rejected).',
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  // Reject non-UUIDs so a malformed reference can never persist and break the read path.
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TEMPLATE_QUESTIONS)
  @ArrayUnique()
  questionIds: string[];
}
