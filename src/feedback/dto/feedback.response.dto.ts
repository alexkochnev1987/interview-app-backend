import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FeedbackResponseDto {
  @ApiProperty()
  position: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  expiresAt: string;

  @ApiPropertyOptional({ enum: ['pass', 'borderline', 'fail'] })
  overallResult?: 'pass' | 'borderline' | 'fail';

  @ApiPropertyOptional()
  overallScore?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'number' } })
  categoryScores?: Record<string, number>;

  @ApiPropertyOptional()
  generalFeedback?: string;

  @ApiPropertyOptional()
  improvements?: string;
}
