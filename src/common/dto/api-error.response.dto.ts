import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiErrorCode } from '../errors/api-error.codes';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ enum: ApiErrorCode, enumName: 'ApiErrorCode' })
  code: ApiErrorCode;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { errors: ['email must be an email'] },
  })
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '/questions/invalid-id' })
  path?: string;
}
