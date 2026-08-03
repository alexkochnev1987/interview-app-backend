import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileResponseDto {
  @ApiProperty({ example: '8d2a6457-7f4b-4cef-9f10-8cff885f7e15' })
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ example: 'hr' })
  role!: string;

  @ApiPropertyOptional({
    example: 'jane@interview-app.com',
    description:
      'Present when viewing your own profile or when the actor has a privileged role.',
  })
  email?: string;

  @ApiPropertyOptional({
    example: 'https://lh3.googleusercontent.com/a/photo.jpg',
    description:
      'Absolute Google photo URL, a relative /users/{id}/avatar proxy path for a custom upload, or absent when no picture is set.',
  })
  pictureUrl?: string;
}
