import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: '8d2a6457-7f4b-4cef-9f10-8cff885f7e15' })
  id: string;

  @ApiProperty({ example: 'admin@interview-app.com' })
  email: string;

  @ApiProperty({ example: 'Super Admin' })
  name: string;

  @ApiProperty({ example: 'super_admin' })
  role: string;

  @ApiPropertyOptional({ example: 'org_123' })
  organizationId?: string;

  @ApiProperty({ example: false, description: 'Read-only demo account.' })
  demo: boolean;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-06-10T14:30:00.000Z',
    description:
      'When the user finished or skipped first-time onboarding. Null means onboarding is pending.',
    nullable: true,
  })
  onboardingCompletedAt?: Date | null;

  @ApiPropertyOptional({
    enum: ['completed', 'skipped'],
    description: 'How the staff onboarding tour was dismissed.',
  })
  onboardingStatus?: 'completed' | 'skipped';

  @ApiProperty({ example: '2026-05-05T12:00:00.000Z' })
  createdAt: Date;
}
