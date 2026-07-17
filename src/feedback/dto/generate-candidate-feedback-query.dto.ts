import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const CANDIDATE_FEEDBACK_GENERATE_SCOPES = ['all'] as const;

export type CandidateFeedbackGenerateScope =
  (typeof CANDIDATE_FEEDBACK_GENERATE_SCOPES)[number];

export class GenerateCandidateFeedbackQueryDto {
  @ApiProperty({
    enum: CANDIDATE_FEEDBACK_GENERATE_SCOPES,
    description: 'Generation scope. MVP supports only `all`.',
  })
  @IsIn([...CANDIDATE_FEEDBACK_GENERATE_SCOPES])
  scope: CandidateFeedbackGenerateScope;
}
