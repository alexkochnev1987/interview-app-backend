import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PublicCandidateFeedbackQuestionBlockDto,
  PublicCandidateFeedbackTextBlockDto,
} from '../../feedback/dto/candidate-feedback-share-link.responses.dto';
import { CANDIDATE_FEEDBACK_OUTCOMES } from '../../feedback/interfaces/candidate-feedback.interface';
import { INTERVIEW_STATUSES } from '../../interview/interfaces/interview.interface';
import { SUPPORTED_LOCALES, Locale } from '../../locale/locale.constants';

export class CandidatePortalInterviewListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  position: string;

  @ApiProperty({ enum: INTERVIEW_STATUSES })
  status: (typeof INTERVIEW_STATUSES)[number];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ minimum: 0 })
  questionCount: number;

  @ApiProperty({
    minimum: 1,
    description:
      'Recording attempts allowed per question (server-configured, same for every interview).',
  })
  maxAnswerAttempts: number;

  @ApiProperty({
    description:
      'True once HR has published at least one candidate-feedback block for this interview.',
  })
  resultsReady: boolean;

  @ApiPropertyOptional({
    description:
      'Relative take-flow URL with a freshly minted candidate token; present only while the interview is not yet finished.',
  })
  continueUrl?: string;
}

export class CandidatePortalInterviewResultsResponseDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES })
  interviewLocale: Locale;

  @ApiProperty()
  position: string;

  @ApiPropertyOptional({ format: 'date-time' })
  interviewDate?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  overallScore?: number;

  @ApiPropertyOptional({ enum: CANDIDATE_FEEDBACK_OUTCOMES })
  outcome?: (typeof CANDIDATE_FEEDBACK_OUTCOMES)[number];

  @ApiPropertyOptional()
  outcomeMessage?: string;

  @ApiPropertyOptional({ type: PublicCandidateFeedbackTextBlockDto })
  overall?: PublicCandidateFeedbackTextBlockDto;

  @ApiPropertyOptional({ type: [PublicCandidateFeedbackQuestionBlockDto] })
  questions?: PublicCandidateFeedbackQuestionBlockDto[];
}
