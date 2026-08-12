import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  CANDIDATE_FEEDBACK_BLOCK_STATES,
  CANDIDATE_FEEDBACK_OUTCOMES,
} from '../interfaces/candidate-feedback.interface';

export class CandidateFeedbackBlockDto {
  @ApiPropertyOptional({
    description: 'Candidate-facing strengths / recommendations text.',
  })
  recommendationText?: string;

  @ApiPropertyOptional({
    description: 'Candidate-facing growth areas / improvement text.',
  })
  improvementText?: string;

  @ApiProperty({
    enum: CANDIDATE_FEEDBACK_BLOCK_STATES,
    description:
      'Block lifecycle: not_generated → generating → generated; HR may lock via accepted/edited; failed when AI errors. Eligibility skips prefill candidate-facing template text with state edited.',
  })
  state: (typeof CANDIDATE_FEEDBACK_BLOCK_STATES)[number];

  @ApiPropertyOptional({
    description:
      'Present when generation failed, or when an eligibility skip stored an HR-only skip-reason hint (not candidate-facing text).',
  })
  errorMessage?: string;
}

export class CandidateFeedbackQuestionBlockDto extends CandidateFeedbackBlockDto {
  @ApiProperty({ minimum: 0 })
  questionIndex: number;

  @ApiProperty({ format: 'uuid' })
  questionId: string;
}

export class CandidateFeedbackResponseDto {
  @ApiProperty({ format: 'uuid' })
  interviewId: string;

  @ApiProperty({ type: CandidateFeedbackBlockDto })
  overall: CandidateFeedbackBlockDto;

  @ApiProperty({ type: [CandidateFeedbackQuestionBlockDto] })
  questions: CandidateFeedbackQuestionBlockDto[];

  @ApiPropertyOptional({
    enum: CANDIDATE_FEEDBACK_OUTCOMES,
    description:
      'Candidate-facing next-step outcome. When set, the public share page shows a preset or custom message.',
  })
  outcome?: (typeof CANDIDATE_FEEDBACK_OUTCOMES)[number];

  @ApiPropertyOptional({
    type: String,
    description:
      'Present when outcome is `custom`. Preset outcomes use client i18n instead.',
  })
  outcomeMessage?: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
