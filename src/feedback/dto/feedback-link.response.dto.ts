import { ApiProperty } from '@nestjs/swagger';

export class FeedbackLinkResponseDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  expiresAt: Date;
}
