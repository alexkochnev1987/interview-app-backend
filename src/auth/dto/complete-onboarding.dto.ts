import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class CompleteOnboardingDto {
  @ApiPropertyOptional({
    enum: ['completed', 'skipped'],
    description:
      'How the user closed onboarding. Both values persist the same completion timestamp.',
    example: 'completed',
  })
  @IsOptional()
  @IsIn(['completed', 'skipped'])
  status?: 'completed' | 'skipped';
}
