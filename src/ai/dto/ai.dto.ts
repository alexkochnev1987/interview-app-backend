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
import { CreateQuestionDto } from '../../question/dto/create-question.dto';

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
  @ApiPropertyOptional({ type: CreateQuestionDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateQuestionDto)
  question?: Partial<CreateQuestionDto>;
}

export class AiTextResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  response!: string;
}
