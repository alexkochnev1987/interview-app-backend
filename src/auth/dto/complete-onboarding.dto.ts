import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import {
  ONBOARDING_STATUSES,
  type OnboardingStatus,
} from '../../user/interfaces/user.interface';

export class CompleteOnboardingDto {
  @ApiPropertyOptional({ enum: ONBOARDING_STATUSES, example: 'completed' })
  @IsOptional()
  @IsIn(ONBOARDING_STATUSES)
  status?: OnboardingStatus;
}
