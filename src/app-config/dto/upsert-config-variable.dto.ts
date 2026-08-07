import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertConfigVariableDto {
  @ApiProperty({
    description: 'Variable value as string (numbers and booleans are stored as text)',
    example: '240',
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({
    description: 'Data type hint for parsing and UI rendering',
    enum: ['string', 'number', 'boolean', 'enum', 'json', 'secret'],
    default: 'string',
  })
  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'enum', 'json', 'secret'])
  valueType?: 'string' | 'number' | 'boolean' | 'enum' | 'json' | 'secret';

  @ApiPropertyOptional({
    description: 'Allowed option values for enum variables',
    type: [String],
    example: ['innowise', 'red', 'blue', 'purple'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({
    description: 'Whether this variable is exposed to the frontend via GET /config/public',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the value is masked in Super Admin list responses',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @ApiPropertyOptional({
    description: 'Human-readable English description shown in Super Admin UI',
    example: 'Maximum candidate video response recording limit in seconds per question',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
