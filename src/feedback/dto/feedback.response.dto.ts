import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';

export class FeedbackResponseDto {
  @ApiProperty({
    enum: SUPPORTED_LOCALES,
    description:
      'Locale used for AI-generated feedback text (interview.interviewLocale). v1 is single-locale only — not multi-locale.',
  })
  interviewLocale: Locale;

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

  @ApiPropertyOptional({
    description: 'Overall AI summary in interviewLocale (stored at completion).',
  })
  generalFeedback?: string;

  @ApiPropertyOptional({
    description: 'Improvement notes in interviewLocale (aggregated from weak answers).',
  })
  improvements?: string;
}
