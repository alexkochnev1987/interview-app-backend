import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SystemConfigEntryDto {
  @ApiProperty({
    description: 'Configuration variable key in UPPER_SNAKE_CASE',
    example: 'APP_THEME',
  })
  key: string;

  @ApiProperty({
    description: 'Current variable value',
    example: 'innowise',
  })
  value: string;

  @ApiProperty({
    description: 'Data type hint for parsing and UI rendering',
    enum: ['string', 'number', 'boolean', 'enum', 'json', 'secret'],
    example: 'enum',
  })
  valueType: 'string' | 'number' | 'boolean' | 'enum' | 'json' | 'secret';

  @ApiPropertyOptional({
    description: 'Allowed option values for enum type variables',
    type: [String],
    example: ['innowise', 'red', 'blue', 'purple'],
  })
  options?: string[];

  @ApiPropertyOptional({
    description: 'Human-readable description of variable purpose',
    example: 'Active UI theme color preset',
  })
  description?: string;

  @ApiProperty({
    description: 'Whether this variable is exposed in GET /api/config/public',
    example: true,
  })
  isPublic: boolean;

  @ApiProperty({
    description: 'Whether the value is masked on the frontend (••••••••)',
    example: false,
  })
  isSecret: boolean;

  @ApiProperty({
    description: 'Whether this variable has a custom database override applied',
    example: false,
  })
  isOverridden: boolean;
}
