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

  @ApiProperty({ example: '2026-05-05T12:00:00.000Z' })
  createdAt: Date;
}
