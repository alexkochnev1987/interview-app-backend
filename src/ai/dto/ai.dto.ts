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
import { SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';

export type DraftQuestionMode = 'translate' | 'generate';

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
  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    default: 'en',
    description:
      'Locale for generated draft text (`en`|`be`|`ru`|`pl`). Defaults to `en`. When omitted, uses `X-Locale` header (also defaults to `en`).',
    example: 'pl',
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: Locale;

  @ApiPropertyOptional({
    enum: ['translate', 'generate'],
    description:
      'Optional explicit mode. `translate` translates `question.questionText` from `question.primaryLocale` to `locale` for any non-equal pair in en|be|ru|pl (4x3 directions). `generate` builds a full draft in `locale`. If omitted, mode is auto-detected: locale mismatch + no rubric seed => translate, otherwise generate.',
    example: 'translate',
  })
  @IsOptional()
  @IsIn(['translate', 'generate'])
  mode?: DraftQuestionMode;

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
