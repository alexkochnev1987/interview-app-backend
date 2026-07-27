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
import { InterviewListItemDto } from '../../../interview/dto/interview.responses.dto';

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

export class RecruiterAssistantCreatePendingActionDto {
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

export class RecruiterAssistantAssignHrPendingActionDto {
  @ApiProperty({ enum: ['assign_hr'] })
  @IsIn(['assign_hr'])
  type: 'assign_hr';
  @ApiProperty() @IsString() interviewId: string;
  @ApiProperty() @IsString() assignedHrId: string;
  @ApiProperty() @IsString() assignedHrName: string;
  @ApiProperty() @IsString() interviewLabel: string;
}

export type RecruiterAssistantPendingActionDto =
    | RecruiterAssistantCreatePendingActionDto
    | RecruiterAssistantAssignHrPendingActionDto;

export class RecruiterAssistantChatDto {
  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(RecruiterAssistantCreatePendingActionDto) },
      { $ref: getSchemaPath(RecruiterAssistantAssignHrPendingActionDto) },
    ],
  })
  @IsOptional()
  @ValidateNested()
  @Type((options) => {
    const pendingAction = (options?.object as RecruiterAssistantChatDto | undefined)
      ?.pendingAction;
    if (pendingAction?.type === 'assign_hr') {
      return RecruiterAssistantAssignHrPendingActionDto;
    }
    return RecruiterAssistantCreatePendingActionDto;
  })
  pendingAction?: RecruiterAssistantPendingActionDto;
}

export class RecruiterAssistantCreatedInterviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  candidateLink: string;
}

export class RecruiterAssistantReviewStateDto {
  @ApiProperty() reviewed: boolean;
  @ApiPropertyOptional() shareLinkActive?: boolean;
  @ApiPropertyOptional() outcome?: string;
}

export class RecruiterAssistantInterviewSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() candidateName: string;
  @ApiProperty() position: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional() candidateLink?: string;
  @ApiPropertyOptional({ type: RecruiterAssistantReviewStateDto })
  reviewState?: RecruiterAssistantReviewStateDto;
}

export class RecruiterAssistantResponseDto {
  @ApiProperty()
  response: string;

  @ApiProperty({ enum: ['answered', 'needs_confirmation', 'executed', 'refused', 'denied'] })
  status: 'answered' | 'needs_confirmation' | 'executed' | 'refused' | 'denied';

  @ApiPropertyOptional({ type: [RecruiterAssistantSuggestedQuestionDto] })
  suggestedQuestions?: RecruiterAssistantSuggestedQuestionDto[];

  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(RecruiterAssistantCreatePendingActionDto) },
      { $ref: getSchemaPath(RecruiterAssistantAssignHrPendingActionDto) },
    ],
  })
  pendingAction?: RecruiterAssistantPendingActionDto;

  @ApiPropertyOptional({ type: RecruiterAssistantCreatedInterviewDto })
  createdInterview?: RecruiterAssistantCreatedInterviewDto;

  @ApiPropertyOptional({ enum: ['hr', 'admin', 'super_admin'] })
  escalateTo?: 'hr' | 'admin' | 'super_admin';

  @ApiPropertyOptional({ type: [InterviewListItemDto] })
  interviews?: InterviewListItemDto[];

  @ApiPropertyOptional({ type: RecruiterAssistantInterviewSummaryDto })
  interview?: RecruiterAssistantInterviewSummaryDto;
}

@ApiExtraModels(
  RecruiterAssistantSuggestedQuestionDto,
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantReviewStateDto,
  RecruiterAssistantInterviewSummaryDto,
  InterviewListItemDto,
)
export class RecruiterAssistantOpenApiModelsDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  marker?: Record<string, unknown>;
}
