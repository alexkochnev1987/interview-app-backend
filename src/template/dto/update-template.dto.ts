import { ApiPropertyOptional } from '@nestjs/swagger';
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

// Partial update; when questionIds is supplied it must still be a non-empty unique array.
export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  name?: string;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  questionIds?: string[];
}
