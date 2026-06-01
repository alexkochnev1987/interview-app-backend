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

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  followUpQuestions: string[];

  @ApiProperty({ type: [QuestionExpectedConceptDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionExpectedConceptDto)
  expectedConcepts: QuestionExpectedConceptDto[];

  @ApiProperty({ type: [QuestionRedFlagDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionRedFlagDto)
  redFlags: QuestionRedFlagDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sampleGoodAnswer?: string;
}
