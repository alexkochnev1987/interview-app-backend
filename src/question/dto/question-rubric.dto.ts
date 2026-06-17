import { ApiProperty } from '@nestjs/swagger';

export class QuestionExpectedConceptDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  weight: number;

  @ApiProperty()
  description: string;
}

export class QuestionRedFlagDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  severity: 'low' | 'medium' | 'high';
}
