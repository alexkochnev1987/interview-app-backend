import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionDraftInputDto } from '../../question/dto/question-draft-input.dto';

export class ChatHistoryItemDto {
  @ApiProperty({ enum: ['system', 'assistant', 'candidate'] })
  @IsIn(['system', 'assistant', 'candidate'])
  role!: 'system' | 'assistant' | 'candidate';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class ChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  position!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  candidateName!: string;

  @ApiProperty({ type: [ChatHistoryItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history!: ChatHistoryItemDto[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class GreetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  candidateName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  position!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalQuestions!: number;
}

export class DraftQuestionDto {
  @ApiPropertyOptional({ type: QuestionDraftInputDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QuestionDraftInputDto)
  question?: QuestionDraftInputDto;
}

export class AiTextResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  response!: string;
}
