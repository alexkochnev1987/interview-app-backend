import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiCreatedResponse,
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
import { resolveTakeContentLocale } from './take-locale';
import { AnswerValidationWorkflowService } from '../interview/answer-validation-workflow.service';
import {
  CANDIDATE_SESSION_COOKIE,
  getCandidateSessionCookieOptions,
} from '../auth/candidate-session';
import { AppConfigService } from '../app-config/app-config.service';
import {
  FinalizeAnswerAttemptDto,
  FinalizeTakeAnswerResponseDto,
  ReserveAnswerAttemptDto,
  ReserveTakeAnswerResponseDto,
  SaveAnswerProgressDto,
  SaveTakeAnswerProgressResponseDto,
  StartTakeAnswerValidationResponseDto,
  SubmitAnswerDto,
  SubmitTakeAnswerResponseDto,
  TakeInterviewResponseDto,
} from './dto/take.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { buildCurrentAnswerMeta } from './take-answer-meta';

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
    private readonly appConfig: AppConfigService,
  ) {}

  @Get(':id')
  @UseGuards(CandidateAuthGuard)
  @ApiCookieAuth('candidateSessionAuth')
  @ApiOperation({
    summary: 'Get candidate interview state',
    description:
      'Resolves currentQuestion using optional contentLocale (UI language), then interviewLocale, primaryLocale, and any available translation. X-Locale is ignored on take. Includes resolvedLocale and optional fallbackFromLocale.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'token', required: false })
  @ApiQuery({
    name: 'contentLocale',
    required: false,
    enum: ['en', 'be', 'ru', 'pl'],
    description:
      'Candidate UI language for currentQuestion. Omit to use interviewLocale.',
  })
  @ApiOkResponse({ type: TakeInterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getInterview(
    @Param('id') id: string,
    @Query('token') token: string,
    @Query('contentLocale') contentLocale: string | undefined,
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
    const takeContentLocale = resolveTakeContentLocale(contentLocale, interview);
    const maxAttempts = await this.appConfig.getNumber('MAX_ANSWER_ATTEMPTS_PER_QUESTION', 3);
    const maxDurationSeconds = await this.appConfig.getNumber('MAX_ANSWER_DURATION_SECONDS', 300);

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
        maxAttempts,
        maxDurationSeconds,
        completed: true,
      };
    }

    const currentQuestion = buildCandidateQuestionView(
      interview.questions[answeredCount],
      takeContentLocale,
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
        ? buildCurrentAnswerMeta(currentAnswer)
        : null,
      maxAttempts,
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

    if (typeof body.durationSeconds === 'number' && body.durationSeconds > 0) {
      const maxDuration = await this.appConfig.getNumber('MAX_ANSWER_DURATION_SECONDS', 300);
      const maxAllowed = maxDuration + 30; // 30-second loyalty grace window (Scenario A)
      if (body.durationSeconds > maxAllowed) {
        throw new BadRequestException(
          `Answer recording duration (${body.durationSeconds}s) exceeds maximum allowed limit of ${maxDuration}s.`,
        );
      }
    }

    const updated = await this.interviewService.addAnswer(id, body);

    const submittedCount = updated.answers.filter(
      (answer) => answer.status === 'submitted',
    ).length;
    const isLast = submittedCount >= updated.questions.length;
    return {
      ok: true,
      answeredCount: submittedCount,
      totalQuestions: updated.questions.length,
      completed: isLast,
    };
  }

  @Post(':id/answer/finalize')
  @UseGuards(CandidateSessionGuard)
  @ApiCookieAuth('candidateSessionAuth')
  @ApiOperation({
    summary: 'Finalize and submit the current question using stored answer media',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: FinalizeAnswerAttemptDto })
  @ApiOkResponse({ type: FinalizeTakeAnswerResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async finalizeAnswer(
    @Param('id') id: string,
    @Body() body: FinalizeAnswerAttemptDto,
    @Req() req: CandidateRequest,
  ) {
    const tokenMismatch = getCandidateTokenMismatchReason(
      id,
      req.candidatePayload.interviewId,
    );
    if (tokenMismatch) {
      throw new BadRequestException(tokenMismatch);
    }

    const result = await this.interviewService.finalizeAnswer(id, body);
    const updated = result.interview;
    const submittedCount = updated.answers.filter(
      (answer) => answer.status === 'submitted',
    ).length;
    const isLast = submittedCount >= updated.questions.length;

    return {
      ok: true,
      answeredCount: submittedCount,
      totalQuestions: updated.questions.length,
      completed: isLast,
      selectedVersionNumber: result.selectedVersionNumber,
      alreadySubmitted: result.alreadySubmitted,
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

    if (typeof body.durationSeconds === 'number' && body.durationSeconds > 0) {
      const maxDuration = await this.appConfig.getNumber('MAX_ANSWER_DURATION_SECONDS', 300);
      const maxAllowed = maxDuration + 30; // 30-second loyalty grace window (Scenario A)
      if (body.durationSeconds > maxAllowed) {
        throw new BadRequestException(
          `Answer recording duration (${body.durationSeconds}s) exceeds maximum allowed limit of ${maxDuration}s.`,
        );
      }
    }

    const updated = await this.interviewService.saveAnswerProgress(id, body);
    const currentAnswer = updated.answers.find(
      (answer) => answer.questionIndex === body.questionIndex,
    );

    return {
      ok: true,
      status: currentAnswer?.status ?? 'recording',
      versionCount: currentAnswer?.versions?.length ?? 0,
      selectedVersionNumber: currentAnswer?.selectedVersionNumber ?? body.versionNumber,
    };
  }

  @Post(':id/answer/reserve')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CandidateSessionGuard)
  @ApiCookieAuth('candidateSessionAuth')
  @ApiOperation({ summary: 'Reserve a candidate answer recording attempt' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ReserveAnswerAttemptDto })
  @ApiCreatedResponse({ type: ReserveTakeAnswerResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async reserveAnswerAttempt(
    @Param('id') id: string,
    @Body() body: ReserveAnswerAttemptDto,
    @Req() req: CandidateRequest,
  ) {
    const tokenMismatch = getCandidateTokenMismatchReason(
      id,
      req.candidatePayload.interviewId,
    );
    if (tokenMismatch) {
      throw new BadRequestException(tokenMismatch);
    }

    return this.interviewService.reserveAnswerAttempt(id, body);
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
