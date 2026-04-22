import {
  Body,
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { InterviewService } from './interview.service';

class AnswerTranscriptDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  generatedAt?: Date;
}

class AnswerEvaluationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  overallScore?: number;

  @IsOptional()
  @IsObject()
  categoryScores?: Record<string, number>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coveredConceptIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missedConceptIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  redFlagIds?: string[];

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  behaviorRisk?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsIn(['pass', 'review', 'fail'])
  decisionHint?: 'pass' | 'review' | 'fail';

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  evaluatedAt?: Date;
}

class AnswerValidationCallbackDto {
  @IsString()
  @IsNotEmpty()
  interviewId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsIn(['completed', 'failed'])
  status!: 'completed' | 'failed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersionNumber?: number;

  @IsOptional()
  @IsString()
  executionArn?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnswerTranscriptDto)
  transcript?: AnswerTranscriptDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnswerEvaluationDto)
  evaluation?: AnswerEvaluationDto;

  @Type(() => Date)
  @IsDate()
  completedAt!: Date;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

@Controller('workflows/answer-validations')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
)
export class AnswerValidationWorkflowController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post('callback')
  async handleCallback(
    @Headers('x-workflow-secret') workflowSecret: string | undefined,
    @Body() body: AnswerValidationCallbackDto,
  ) {
    this.assertWorkflowSecret(workflowSecret);

    const interview =
      body.status === 'completed'
        ? await this.interviewService.completeAnswerValidation(body.interviewId, {
            questionIndex: body.questionIndex,
            sourceVersionNumber: body.sourceVersionNumber ?? 1,
            executionArn: body.executionArn,
            transcript: body.transcript,
            evaluation: body.evaluation,
            completedAt: body.completedAt,
          })
        : await this.interviewService.failAnswerValidation(body.interviewId, {
            questionIndex: body.questionIndex,
            sourceVersionNumber: body.sourceVersionNumber,
            executionArn: body.executionArn,
            errorMessage: body.errorMessage,
            completedAt: body.completedAt,
          });

    const answer = interview.answers.find(
      (item) => item.questionIndex === body.questionIndex,
    );

    return {
      ok: true,
      status: answer?.validation?.status ?? body.status,
      questionIndex: body.questionIndex,
    };
  }

  private assertWorkflowSecret(receivedSecret: string | undefined): void {
    const expectedSecret =
      process.env.WORKFLOW_CALLBACK_SECRET?.trim() ??
      process.env.JWT_SECRET?.trim();

    if (!expectedSecret) {
      throw new ServiceUnavailableException(
        'Workflow callback secret is not configured',
      );
    }

    if (!receivedSecret || receivedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid workflow callback secret');
    }
  }
}
