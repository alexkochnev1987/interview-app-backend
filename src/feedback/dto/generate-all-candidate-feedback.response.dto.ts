import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CandidateFeedbackResponseDto } from './candidate-feedback.responses.dto';

export const CANDIDATE_FEEDBACK_GENERATION_RESULT_STATUSES = [
  'generated',
  'skipped',
  'failed',
] as const;

export const CANDIDATE_FEEDBACK_QUESTION_SKIP_REASONS = [
  'locked',
  'in_progress',
  'not_submitted',
  'missing_answer',
  'missing_transcript',
  'missing_question',
] as const;

export const CANDIDATE_FEEDBACK_OVERALL_SKIP_REASONS = [
  'locked',
  'in_progress',
  'no_question_texts',
] as const;

export class GenerateAllCandidateFeedbackQuestionResultDto {
  @ApiProperty({ enum: CANDIDATE_FEEDBACK_GENERATION_RESULT_STATUSES })
  status: (typeof CANDIDATE_FEEDBACK_GENERATION_RESULT_STATUSES)[number];

  @ApiProperty({ minimum: 0 })
  questionIndex: number;

  @ApiPropertyOptional({ enum: CANDIDATE_FEEDBACK_QUESTION_SKIP_REASONS })
  reason?: (typeof CANDIDATE_FEEDBACK_QUESTION_SKIP_REASONS)[number];

  @ApiPropertyOptional()
  errorMessage?: string;
}

export class GenerateAllCandidateFeedbackOverallResultDto {
  @ApiProperty({ enum: CANDIDATE_FEEDBACK_GENERATION_RESULT_STATUSES })
  status: (typeof CANDIDATE_FEEDBACK_GENERATION_RESULT_STATUSES)[number];

  @ApiPropertyOptional({ enum: CANDIDATE_FEEDBACK_OVERALL_SKIP_REASONS })
  reason?: (typeof CANDIDATE_FEEDBACK_OVERALL_SKIP_REASONS)[number];

  @ApiPropertyOptional()
  errorMessage?: string;
}

export class GenerateAllCandidateFeedbackResponseDto {
  @ApiProperty({ type: CandidateFeedbackResponseDto })
  feedback: CandidateFeedbackResponseDto;

  @ApiProperty({ type: [GenerateAllCandidateFeedbackQuestionResultDto] })
  questions: GenerateAllCandidateFeedbackQuestionResultDto[];

  @ApiProperty({ type: GenerateAllCandidateFeedbackOverallResultDto })
  overall: GenerateAllCandidateFeedbackOverallResultDto;
}
