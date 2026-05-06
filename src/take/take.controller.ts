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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
import {
  SaveAnswerProgressDto,
  SaveTakeAnswerProgressResponseDto,
  StartTakeAnswerValidationResponseDto,
  SubmitAnswerDto,
  SubmitTakeAnswerResponseDto,
  TakeInterviewResponseDto,
} from './dto/take.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

interface CandidateRequest {
  candidatePayload: { interviewId: string };
  candidateTokenSource?: 'query' | 'cookie';
}

@ApiTags('take')
@Controller('take')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
)
export class TakeController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly answerValidationWorkflowService: AnswerValidationWorkflowService,
  ) {}

  @Get(':id')
  @UseGuards(CandidateAuthGuard)
  @ApiOperation({ summary: 'Get candidate interview state' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: TakeInterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
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
  @ApiOperation({ summary: 'Submit candidate answer' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SubmitAnswerDto })
  @ApiOkResponse({ type: SubmitTakeAnswerResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
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
  @ApiOperation({ summary: 'Save candidate answer progress' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SaveAnswerProgressDto })
  @ApiOkResponse({ type: SaveTakeAnswerProgressResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
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
  @ApiOperation({ summary: 'Start candidate answer validation' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'questionIndex' })
  @ApiOkResponse({ type: StartTakeAnswerValidationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
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
