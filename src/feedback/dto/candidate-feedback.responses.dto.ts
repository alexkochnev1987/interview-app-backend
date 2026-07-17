import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CANDIDATE_FEEDBACK_BLOCK_STATES } from '../interfaces/candidate-feedback.interface';

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

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
