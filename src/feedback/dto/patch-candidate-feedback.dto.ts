import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH,
  HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES,
} from '../candidate-feedback-block-rules';

const HR_PATCH_STATE_DESCRIPTION =
  'HR may accept generated text or mark manual edits. `accepted` and `edited` require at least one non-empty text on the block (from the request or already stored).';

export class PatchCandidateFeedbackOverallBlockDto {
  @ApiPropertyOptional({
    description: 'Candidate-facing strengths / recommendations text.',
    maxLength: CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH)
  recommendationText?: string;

  @ApiPropertyOptional({
    description: 'Candidate-facing growth areas / improvement text.',
    maxLength: CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH)
  improvementText?: string;

  @ApiPropertyOptional({
    enum: HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES,
    description: HR_PATCH_STATE_DESCRIPTION,
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
    maxLength: CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH)
  recommendationText?: string;

  @ApiPropertyOptional({
    description: 'Candidate-facing growth areas / improvement text.',
    maxLength: CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(CANDIDATE_FEEDBACK_TEXT_MAX_LENGTH)
  improvementText?: string;

  @ApiPropertyOptional({
    enum: HR_PATCHABLE_CANDIDATE_FEEDBACK_BLOCK_STATES,
    description: HR_PATCH_STATE_DESCRIPTION,
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
