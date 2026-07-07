import { ApiProperty } from '@nestjs/swagger';

export class MarkInterviewDemoResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: '00000000-0000-4000-8000-0000000000a1' })
  interviewId!: string;

  @ApiProperty({ example: true })
  placeholderRemoved!: boolean;
}
