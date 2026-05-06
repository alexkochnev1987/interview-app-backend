import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@interview-app.com' })
  email: string;

  @ApiProperty({ example: 'admin123' })
  password: string;
}
