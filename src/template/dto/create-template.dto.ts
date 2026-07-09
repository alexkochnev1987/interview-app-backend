import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
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
  @ArrayUnique()
  questionIds: string[];
}
