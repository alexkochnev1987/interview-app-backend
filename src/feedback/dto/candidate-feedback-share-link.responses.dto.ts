import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';

export class CandidateFeedbackShareLinkResponseDto {
  @ApiProperty({
    description:
      'Absolute frontend URL embedding the one-time plaintext share token.',
  })
  url: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
}

export class CandidateFeedbackShareLinkStatusResponseDto {
  @ApiProperty({
    format: 'date-time',
    description:
      'Expiry of a usable share link (non-revoked, not expired, with publishable feedback). URL is never reconstructed from storage (DB stores sha256 only).',
  })
  expiresAt: Date;
}

export class PublicCandidateFeedbackTextBlockDto {
  @ApiPropertyOptional({
    description: 'Candidate-facing strengths / recommendations text.',
  })
  recommendationText?: string;

  @ApiPropertyOptional({
    description: 'Candidate-facing growth areas / improvement text.',
  })
  improvementText?: string;
}

export class PublicCandidateFeedbackQuestionBlockDto extends PublicCandidateFeedbackTextBlockDto {
  @ApiProperty({ minimum: 0 })
  questionIndex: number;

  @ApiProperty({ format: 'uuid' })
  questionId: string;
}

export class PublicCandidateFeedbackResponseDto {
  @ApiProperty({
    enum: SUPPORTED_LOCALES,
    description: 'Locale of the shared candidate-facing feedback text.',
  })
  interviewLocale: Locale;

  @ApiProperty()
  position: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  @ApiPropertyOptional({
    type: PublicCandidateFeedbackTextBlockDto,
    description:
      'Present only when overall is accepted/edited with publishable text.',
  })
  overall?: PublicCandidateFeedbackTextBlockDto;

  @ApiPropertyOptional({
    type: [PublicCandidateFeedbackQuestionBlockDto],
    description:
      'Only accepted/edited question blocks with publishable text; omitted when empty.',
  })
  questions?: PublicCandidateFeedbackQuestionBlockDto[];
}
