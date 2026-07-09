import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResolvedQuestionResponseDto } from '../../question/dto/question.responses.dto';

export class TemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  position?: string;

  @ApiProperty({
    description:
      'Number of currently-resolvable questions (references that are deleted or ' +
      'pending deletion are excluded).',
  })
  questionCount: number;

  @ApiProperty({
    type: [ResolvedQuestionResponseDto],
    description:
      'Live question rows resolved from the stored ids, in stored order, for the ' +
      'request locale. Seeds the interview question picker on edit and prefill.',
  })
  questions: ResolvedQuestionResponseDto[];

  @ApiPropertyOptional({
    description: 'Id of the user who created the template (attribution only).',
  })
  createdById?: string;

  @ApiProperty()
  demo: boolean;

  @ApiProperty({
    description:
      'Popularity: how many interviews have been created from this template.',
  })
  usageCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TemplateUsageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Usage count after the increment.' })
  usageCount: number;
}

export class DeleteTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: [true] })
  deleted: true;
}
