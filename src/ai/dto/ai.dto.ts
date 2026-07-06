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
      'Optional explicit mode. `translate` translates the full primary content block from `question.primaryLocale` to body `locale` (one target locale per call); concept/red-flag ids are preserved 1:1; returns content block only. Requires body `locale`, `question.primaryLocale`, and the full primary rubric in the request. `generate` returns identity fields plus the primary locale rubric content block. If omitted, mode is auto-detected: locale mismatch + full primary content => translate, otherwise generate.',
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
