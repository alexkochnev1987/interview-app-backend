import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SUPPORTED_LOCALES } from '../../../locale/locale.constants';
import { Locale } from '../../../locale/locale.constants';
import { QuestionDifficulty } from '../../../question/interfaces/question.interface';

export class RecruiterAssistantSuggestedQuestionDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  questionText: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcategory?: string;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedConcepts?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  followUpQuestions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sampleGoodAnswer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  existingQuestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  existingQuestionText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  needsCreation?: boolean;
}

export class RecruiterAssistantPendingActionDto {
  @ApiProperty({ enum: ['create_questions', 'create_interview'] })
  @IsIn(['create_questions', 'create_interview'])
  type: 'create_questions' | 'create_interview';

  @ApiProperty()
  @IsString()
  position: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  candidateEmail?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  interviewLocale?: Locale;

  @ApiProperty({ type: [RecruiterAssistantSuggestedQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecruiterAssistantSuggestedQuestionDto)
  questions: RecruiterAssistantSuggestedQuestionDto[];
}

export class RecruiterAssistantChatDto {
  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ type: RecruiterAssistantPendingActionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruiterAssistantPendingActionDto)
  pendingAction?: RecruiterAssistantPendingActionDto;
}

export class RecruiterAssistantCreatedInterviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  candidateLink: string;
}

export class RecruiterAssistantResponseDto {
  @ApiProperty()
  response: string;

  @ApiProperty({ enum: ['answered', 'needs_confirmation', 'executed', 'refused'] })
  status: 'answered' | 'needs_confirmation' | 'executed' | 'refused';

  @ApiPropertyOptional({ type: [RecruiterAssistantSuggestedQuestionDto] })
  suggestedQuestions?: RecruiterAssistantSuggestedQuestionDto[];

  @ApiPropertyOptional({
    oneOf: [{ $ref: getSchemaPath(RecruiterAssistantPendingActionDto) }],
  })
  pendingAction?: RecruiterAssistantPendingActionDto;

  @ApiPropertyOptional({ type: RecruiterAssistantCreatedInterviewDto })
  createdInterview?: RecruiterAssistantCreatedInterviewDto;
}

@ApiExtraModels(
  RecruiterAssistantSuggestedQuestionDto,
  RecruiterAssistantPendingActionDto,
)
export class RecruiterAssistantOpenApiModelsDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  marker?: Record<string, unknown>;
}
