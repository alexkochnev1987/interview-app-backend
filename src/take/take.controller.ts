import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Param,
  Query,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CandidateAuthGuard } from '../auth/guards/candidate-auth.guard';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import { InterviewService } from '../interview/interview.service';
import { AuthService } from '../auth/auth.service';
import { buildCandidateQuestionView } from './take-question-view';
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
import { getCandidateTokenMismatchReason } from './candidate-interview-access';

interface CandidateRequest {
  candidatePayload: { interviewId: string };
  candidateTokenSource?: 'query' | 'cookie';
}

@ApiTags('take')
@Controller('take')
export class TakeController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly answerValidationWorkflowService: AnswerValidationWorkflowService,
  ) {}

  @Get(':id')
  @UseGuards(CandidateAuthGuard)
  @ApiCookieAuth('candidateSessionAuth')
  @ApiOperation({
    summary: 'Get candidate interview state',
    description:
      'Resolves currentQuestion using interviewLocale only (X-Locale is ignored on take). Includes resolvedLocale and optional fallbackFromLocale.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'token', required: false })
  @ApiOkResponse({ type: TakeInterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getInterview(
    @Param('id') id: string,
    @Query('token') token: string,
    @Req() req: CandidateRequest & Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenMismatch = getCandidateTokenMismatchReason(
      id,
      req.candidatePayload.interviewId,
    );
    if (tokenMismatch) {
      throw new BadRequestException(tokenMismatch);
    }

    if (req.candidateTokenSource === 'query') {
      res.cookie(
        CANDIDATE_SESSION_COOKIE,
        this.authService.generateCandidateSessionToken(id),
        getCandidateSessionCookieOptions(),
      );
    }

    const interview = await this.interviewService.findOne(id);
    const takeLocale = interview.interviewLocale;

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
        interviewLocale: interview.interviewLocale,
        candidateName: interview.candidateName,
        status: interview.status,
        totalQuestions,
        currentQuestion: null,
        currentQuestionIndex: answeredCount,
        currentAnswerMeta: null,
        completed: true,
      };
    }

    const currentQuestion = buildCandidateQuestionView(
      interview.questions[answeredCount],
      takeLocale,
    );

    return {
      id: interview.id,
      position: interview.position,
      interviewLocale: interview.interviewLocale,
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
  @ApiCookieAuth('candidateSessionAuth')
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
    const tokenMismatch = getCandidateTokenMismatchReason(
      id,
      req.candidatePayload.interviewId,
    );
    if (tokenMismatch) {
      throw new BadRequestException(tokenMismatch);
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
  @ApiCookieAuth('candidateSessionAuth')
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
    const tokenMismatch = getCandidateTokenMismatchReason(
      id,
      req.candidatePayload.interviewId,
    );
    if (tokenMismatch) {
      throw new BadRequestException(tokenMismatch);
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
  @ApiCookieAuth('candidateSessionAuth')
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
    const tokenMismatch = getCandidateTokenMismatchReason(
      id,
      req.candidatePayload.interviewId,
    );
    if (tokenMismatch) {
      throw new BadRequestException(tokenMismatch);
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
