import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BehaviorSignalsDto {
  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tabHiddenCount = 0;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  windowBlurCount = 0;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pasteCount = 0;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  keydownCount = 0;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  resizeCount = 0;
}

export class BehaviorEventDto {
  @ApiProperty({ enum: ['tab_hidden', 'window_blur', 'paste', 'keydown', 'resize'] })
  @IsIn(['tab_hidden', 'window_blur', 'paste', 'keydown', 'resize'])
  @IsString()
  @IsNotEmpty()
  eventType!: 'tab_hidden' | 'window_blur' | 'paste' | 'keydown' | 'resize';

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber!: number;
}

export class ClientTranscriptDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  language!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  generatedAt!: Date;

  @ApiProperty()
  @IsBoolean()
  isFinal!: boolean;
}

export class SubmitAnswerDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber!: number;

  @ApiProperty()
  @IsBoolean()
  submitAnswer!: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  screenMediaKey?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  startedAt!: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  submittedAt!: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cameraFileSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  screenFileSizeBytes?: number;

  @ApiProperty({ type: () => BehaviorSignalsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => BehaviorSignalsDto)
  behaviorSignals!: BehaviorSignalsDto;

  @ApiPropertyOptional({ type: () => [BehaviorEventDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BehaviorEventDto)
  behaviorEvents?: BehaviorEventDto[];

  @ApiPropertyOptional({ type: () => ClientTranscriptDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClientTranscriptDto)
  clientTranscript?: ClientTranscriptDto;
}

export class SaveAnswerProgressDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  screenMediaKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  submittedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cameraFileSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  screenFileSizeBytes?: number;

  @ApiProperty({ type: () => BehaviorSignalsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => BehaviorSignalsDto)
  behaviorSignals!: BehaviorSignalsDto;

  @ApiPropertyOptional({ type: () => [BehaviorEventDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BehaviorEventDto)
  behaviorEvents?: BehaviorEventDto[];

  @ApiPropertyOptional({ type: () => ClientTranscriptDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClientTranscriptDto)
  clientTranscript?: ClientTranscriptDto;
}

export class CandidateQuestionViewDto {
  @ApiProperty()
  text: string;
}

export class CurrentAnswerMetaDto {
  @ApiProperty({ enum: ['recording', 'submitted'] })
  status: 'recording' | 'submitted';

  @ApiProperty()
  versionCount: number;

  @ApiProperty()
  selectedVersionNumber: number;
}

export class TakeInterviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  position: string;

  @ApiProperty()
  candidateName: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalQuestions: number;

  @ApiPropertyOptional({ type: CandidateQuestionViewDto })
  currentQuestion: CandidateQuestionViewDto | null;

  @ApiProperty()
  currentQuestionIndex: number;

  @ApiPropertyOptional({ type: CurrentAnswerMetaDto })
  currentAnswerMeta: CurrentAnswerMetaDto | null;

  @ApiProperty()
  completed: boolean;
}

export class SubmitTakeAnswerResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty()
  answeredCount: number;

  @ApiProperty()
  totalQuestions: number;

  @ApiProperty()
  completed: boolean;
}

export class SaveTakeAnswerProgressResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ enum: ['recording', 'submitted'] })
  status: 'recording' | 'submitted';

  @ApiProperty()
  versionCount: number;

  @ApiProperty()
  selectedVersionNumber: number;
}

export class StartTakeAnswerValidationResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ enum: ['idle', 'queued', 'processing', 'completed', 'failed'] })
  status: string;

  @ApiProperty()
  questionIndex: number;

  @ApiProperty()
  sourceVersionNumber: number;

  @ApiProperty()
  reused: boolean;
}
