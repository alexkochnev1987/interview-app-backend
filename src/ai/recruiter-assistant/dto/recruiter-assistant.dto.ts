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
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SUPPORTED_LOCALES } from '../../../locale/locale.constants';
import { Locale } from '../../../locale/locale.constants';
import { QuestionDifficulty } from '../../../question/interfaces/question.interface';
import { InterviewListItemDto } from '../../../interview/dto/interview.responses.dto';
import { TemplateSummaryResponseDto } from '../../../template/dto/template.responses.dto';

export const MAX_RECRUITER_ASSISTANT_QUESTIONS = 12;
export const MAX_RECRUITER_ASSISTANT_MESSAGE_LENGTH = 2000;
export const MAX_RECRUITER_ASSISTANT_LABEL_LENGTH = 200;

export class RecruiterAssistantSuggestedQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
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
  @IsUUID()
  existingQuestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
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
  @IsNotEmpty()
  @MaxLength(MAX_RECRUITER_ASSISTANT_LABEL_LENGTH)
  position: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_RECRUITER_ASSISTANT_LABEL_LENGTH)
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
  @ArrayMaxSize(MAX_RECRUITER_ASSISTANT_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => RecruiterAssistantSuggestedQuestionDto)
  questions: RecruiterAssistantSuggestedQuestionDto[];
}

export class RecruiterAssistantAssignHrPendingActionDto {
  @ApiProperty({ enum: ['assign_hr'] })
  @IsIn(['assign_hr'])
  type: 'assign_hr';

  @ApiProperty()
  @IsUUID()
  interviewId: string;

  @ApiProperty()
  @IsUUID()
  assignedHrId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_RECRUITER_ASSISTANT_LABEL_LENGTH)
  assignedHrName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_RECRUITER_ASSISTANT_LABEL_LENGTH)
  interviewLabel: string;
}

export type RecruiterAssistantPendingActionDto =
    | RecruiterAssistantCreatePendingActionDto
    | RecruiterAssistantAssignHrPendingActionDto;

export class RecruiterAssistantChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_RECRUITER_ASSISTANT_MESSAGE_LENGTH)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  pendingActionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class RecruiterAssistantCreatedInterviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  candidateLink: string;
}

export class RecruiterAssistantCreatedQuestionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ description: 'Frontend route when the question card is clicked.' })
  href: string;
}

export class RecruiterAssistantRedirectDto {
  @ApiProperty({ example: '/interviews/new' })
  path: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { candidateName: 'Alice', position: 'React Developer' },
  })
  query?: Record<string, string>;
}

export type RecruiterAssistantAwaitingInput =
  | 'hr'
  | 'interview'
  | 'questionName'
  | 'candidateName'
  | 'position'
  | 'templateChoice';

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

  @ApiPropertyOptional()
  pendingActionId?: string;

  @ApiPropertyOptional()
  sessionId?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  locale?: Locale;

  @ApiPropertyOptional({ type: RecruiterAssistantCreatedQuestionDto })
  createdQuestion?: RecruiterAssistantCreatedQuestionDto;

  @ApiPropertyOptional({ type: RecruiterAssistantRedirectDto })
  redirect?: RecruiterAssistantRedirectDto;

  @ApiPropertyOptional({ type: [TemplateSummaryResponseDto] })
  templates?: TemplateSummaryResponseDto[];

  @ApiPropertyOptional({
    enum: ['hr', 'interview', 'questionName', 'candidateName', 'position', 'templateChoice'],
  })
  awaitingInput?: RecruiterAssistantAwaitingInput;

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
  RecruiterAssistantCreatedQuestionDto,
  RecruiterAssistantRedirectDto,
  TemplateSummaryResponseDto,
  InterviewListItemDto,
)
export class RecruiterAssistantOpenApiModelsDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  marker?: Record<string, unknown>;
}
