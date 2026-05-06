import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
import { Response } from 'express';
import { CandidateAuthGuard } from '../auth/guards/candidate-auth.guard';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import { InterviewService } from '../interview/interview.service';
import { CandidateQuestionView } from '../interview/interfaces/interview.interface';
import { AuthService } from '../auth/auth.service';
import { AnswerValidationWorkflowService } from '../interview/answer-validation-workflow.service';
import {
  CANDIDATE_SESSION_COOKIE,
  getCandidateSessionCookieOptions,
} from '../auth/candidate-session';

interface CandidateRequest {
  candidatePayload: { interviewId: string };
  candidateTokenSource?: 'query' | 'cookie';
}

class BehaviorSignalsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tabHiddenCount = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  windowBlurCount = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  pasteCount = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  keydownCount = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  resizeCount = 0;
}

class BehaviorEventDto {
  @IsIn(['tab_hidden', 'window_blur', 'paste', 'keydown', 'resize', 'copy'])
  @IsString()
  @IsNotEmpty()
  eventType!:
    | 'tab_hidden'
    | 'window_blur'
    | 'paste'
    | 'keydown'
    | 'resize'
    | 'copy';

  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber!: number;
}

class ClientTranscriptDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsNotEmpty()
  language!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @Type(() => Date)
  @IsDate()
  generatedAt!: Date;

  @IsBoolean()
  isFinal!: boolean;
}

class SubmitAnswerDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber!: number;

  @IsBoolean()
  submitAnswer!: boolean;

  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  screenMediaKey?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @Type(() => Date)
  @IsDate()
  startedAt!: Date;

  @Type(() => Date)
  @IsDate()
  submittedAt!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cameraFileSizeBytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  screenFileSizeBytes?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => BehaviorSignalsDto)
  behaviorSignals!: BehaviorSignalsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BehaviorEventDto)
  behaviorEvents?: BehaviorEventDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ClientTranscriptDto)
  clientTranscript?: ClientTranscriptDto;
}

class SaveAnswerProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber!: number;

  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  screenMediaKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  submittedAt?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cameraFileSizeBytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  screenFileSizeBytes?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => BehaviorSignalsDto)
  behaviorSignals!: BehaviorSignalsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BehaviorEventDto)
  behaviorEvents?: BehaviorEventDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ClientTranscriptDto)
  clientTranscript?: ClientTranscriptDto;
}

@Controller('take')
export class TakeController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly answerValidationWorkflowService: AnswerValidationWorkflowService,
  ) {}

  @Get(':id')
  @UseGuards(CandidateAuthGuard)
  async getInterview(
    @Param('id') id: string,
    @Req() req: CandidateRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    if (req.candidateTokenSource === 'query') {
      res.cookie(
        CANDIDATE_SESSION_COOKIE,
        this.authService.generateCandidateSessionToken(id),
        getCandidateSessionCookieOptions(),
      );
    }

    const interview = await this.interviewService.findOne(id);

    // Return only what candidate needs — one question at a time
    const answeredCount = interview.answers.filter(
      (answer) => answer.status === 'submitted',
    ).length;
    const totalQuestions = interview.questions.length;
    const currentAnswer = interview.answers.find(
      (answer) => answer.questionIndex === answeredCount,
    );

    if (answeredCount >= totalQuestions) {
      return {
        id: interview.id,
        position: interview.position,
        candidateName: interview.candidateName,
        status: interview.status,
        totalQuestions,
        currentQuestion: null,
        currentQuestionIndex: answeredCount,
        currentAnswerMeta: null,
        completed: true,
      };
    }

    const currentQuestion: CandidateQuestionView = {
      text: interview.questions[answeredCount].questionText,
    };

    return {
      id: interview.id,
      position: interview.position,
      candidateName: interview.candidateName,
      status: interview.status,
      totalQuestions,
      currentQuestion,
      currentQuestionIndex: answeredCount,
      currentAnswerMeta: currentAnswer
        ? {
            status: currentAnswer.status,
            versionCount: currentAnswer.versions?.length ?? 0,
            selectedVersionNumber: currentAnswer.selectedVersionNumber ?? 1,
          }
        : null,
      completed: false,
    };
  }

  @Post(':id/answer')
  @UseGuards(CandidateSessionGuard)
  async submitAnswer(
    @Param('id') id: string,
    @Body() body: SubmitAnswerDto,
    @Req() req: CandidateRequest,
  ) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    const interview = await this.interviewService.addAnswer(id, body);

    const submittedCount = interview.answers.filter(
      (answer) => answer.status === 'submitted',
    ).length;
    const isLast = submittedCount >= interview.questions.length;
    return {
      ok: true,
      answeredCount: submittedCount,
      totalQuestions: interview.questions.length,
      completed: isLast,
    };
  }

  @Post(':id/answer/progress')
  @UseGuards(CandidateSessionGuard)
  async saveAnswerProgress(
    @Param('id') id: string,
    @Body() body: SaveAnswerProgressDto,
    @Req() req: CandidateRequest,
  ) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    const interview = await this.interviewService.saveAnswerProgress(id, body);
    const currentAnswer = interview.answers.find(
      (answer) => answer.questionIndex === body.questionIndex,
    );

    return {
      ok: true,
      status: currentAnswer?.status ?? 'recording',
      versionCount: currentAnswer?.versions?.length ?? 0,
      selectedVersionNumber: currentAnswer?.selectedVersionNumber ?? body.versionNumber,
    };
  }

  @Post(':id/questions/:questionIndex/validate')
  @UseGuards(CandidateSessionGuard)
  async startAnswerValidation(
    @Param('id') id: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
    @Req() req: CandidateRequest,
  ) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    const validation = await this.answerValidationWorkflowService.startValidation(
      id,
      questionIndex,
    );

    return {
      ok: true,
      ...validation,
    };
  }
}
