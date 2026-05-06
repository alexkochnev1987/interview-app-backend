import { ApiProperty } from '@nestjs/swagger';

export class CreateInterviewDto {
  @ApiProperty()
  candidateName: string;

  @ApiProperty()
  position: string;

  @ApiProperty({ type: [String] })
  questionIds: string[];
}
