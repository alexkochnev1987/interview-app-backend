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
    description:
      'Number of ids stored on the template, including references that no longer ' +
      'resolve. When higher than questionCount, some saved questions are gone.',
  })
  storedQuestionCount: number;

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

// List item: the full response minus the resolved questions array, which the
// list view never reads. Keeps both counts so the UI can flag stale references.
export class TemplateSummaryResponseDto {
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
    description:
      'Number of ids stored on the template, including references that no longer ' +
      'resolve. When higher than questionCount, some saved questions are gone.',
  })
  storedQuestionCount: number;

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

export class DeleteTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: [true] })
  deleted: true;
}
