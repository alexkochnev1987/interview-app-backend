import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateQuestionDto } from '../../question/dto/create-question.dto';

export class ChatHistoryItemDto {
  @ApiProperty({ enum: ['system', 'assistant', 'candidate'] })
  role: 'system' | 'assistant' | 'candidate';

  @ApiProperty()
  content: string;
}

export class ChatDto {
  @ApiProperty()
  question: string;

  @ApiProperty()
  position: string;

  @ApiProperty()
  candidateName: string;

  @ApiProperty({ type: [ChatHistoryItemDto] })
  history: ChatHistoryItemDto[];

  @ApiProperty()
  message: string;
}

export class GreetDto {
  @ApiProperty()
  candidateName: string;

  @ApiProperty()
  position: string;

  @ApiProperty()
  totalQuestions: number;
}

export class DraftQuestionDto {
  @ApiPropertyOptional({ type: CreateQuestionDto })
  question?: Partial<CreateQuestionDto>;
}

export class AiTextResponseDto {
  @ApiProperty()
  response: string;
}
