import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'Lightsail backend is serving the latest deploy.' })
  message: string;

  @ApiProperty({ example: '2026-05-05T12:00:00.000Z' })
  timestamp: Date;
}
