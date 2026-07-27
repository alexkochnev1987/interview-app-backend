import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';
import { CANDIDATE_FEEDBACK_OUTCOMES } from '../interfaces/candidate-feedback.interface';

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

  @ApiPropertyOptional({
    description:
      'Interview question snapshot text in interviewLocale when available on the interview.',
  })
  questionText?: string;
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
    format: 'date-time',
    description:
      'When the candidate completed the interview (result completion time), when available.',
  })
  interviewDate?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description:
      'Interview overall score (0–100) when a result exists; omitted otherwise.',
  })
  overallScore?: number;

  @ApiPropertyOptional({
    enum: CANDIDATE_FEEDBACK_OUTCOMES,
    description:
      'Candidate-facing next-step outcome when HR selected one; omitted otherwise.',
  })
  outcome?: (typeof CANDIDATE_FEEDBACK_OUTCOMES)[number];

  @ApiPropertyOptional({
    type: String,
    description:
      'Custom next-step message when outcome is `custom`; omitted for presets.',
  })
  outcomeMessage?: string;

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