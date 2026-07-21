import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const ONBOARDING_STATUSES = ['completed', 'skipped'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export class CompleteOnboardingDto {
  @ApiProperty({ enum: ONBOARDING_STATUSES, example: 'completed' })
  @IsIn(ONBOARDING_STATUSES)
  status!: OnboardingStatus;
}
