import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES } from '../candidate-feedback-block-rules';

export class PatchCandidateFeedbackOverallBlockDto {
  @ApiPropertyOptional({
    description: 'Candidate-facing strengths / recommendations text.',
  })
  @IsOptional()
  @IsString()
  recommendationText?: string;

  @ApiPropertyOptional({
    description: 'Candidate-facing growth areas / improvement text.',
  })
  @IsOptional()
  @IsString()
  improvementText?: string;

  @ApiPropertyOptional({
    enum: HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES,
    description: 'HR may accept generated text or mark manual edits.',
  })
  @IsOptional()
  @IsIn([...HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES])
  state?: (typeof HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES)[number];
}

export class PatchCandidateFeedbackQuestionBlockDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  questionIndex: number;

  @ApiPropertyOptional({
    description: 'Candidate-facing strengths / recommendations text.',
  })
  @IsOptional()
  @IsString()
  recommendationText?: string;

  @ApiPropertyOptional({
    description: 'Candidate-facing growth areas / improvement text.',
  })
  @IsOptional()
  @IsString()
  improvementText?: string;

  @ApiPropertyOptional({
    enum: HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES,
    description: 'HR may accept generated text or mark manual edits.',
  })
  @IsOptional()
  @IsIn([...HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES])
  state?: (typeof HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES)[number];
}

export class PatchCandidateFeedbackDto {
  @ApiPropertyOptional({
    type: PatchCandidateFeedbackOverallBlockDto,
    description: 'Partial overall block update.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PatchCandidateFeedbackOverallBlockDto)
  overall?: PatchCandidateFeedbackOverallBlockDto;

  @ApiPropertyOptional({
    type: [PatchCandidateFeedbackQuestionBlockDto],
    description: 'Partial per-question block updates.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchCandidateFeedbackQuestionBlockDto)
  questions?: PatchCandidateFeedbackQuestionBlockDto[];
}
