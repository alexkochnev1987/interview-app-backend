import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import {
  QuestionExpectedConceptDto,
  QuestionRedFlagDto,
} from './question.responses.dto';

export class QuestionTranslationDto {
  @ApiProperty()
  @IsString()
  @Length(1, 5000)
  questionText: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional for non-primary locales. Required for primaryLocale.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  followUpQuestions?: string[];

  @ApiPropertyOptional({
    type: [QuestionExpectedConceptDto],
    description: 'Optional for non-primary locales. Required for primaryLocale.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionExpectedConceptDto)
  expectedConcepts?: QuestionExpectedConceptDto[];

  @ApiPropertyOptional({
    type: [QuestionRedFlagDto],
    description: 'Optional for non-primary locales. Required for primaryLocale.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionRedFlagDto)
  redFlags?: QuestionRedFlagDto[];

  @ApiPropertyOptional({
    description: 'Optional for non-primary locales. Required for primaryLocale.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  sampleGoodAnswer?: string;
}
