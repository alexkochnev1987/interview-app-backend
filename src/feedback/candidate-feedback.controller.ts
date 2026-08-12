import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';

import { StaffAiThrottlerGuard } from '../ai/guards/staff-ai-throttler.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { apiConflict } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { Interview } from '../interview/interfaces/interview.interface';
import { InterviewService } from '../interview/interview.service';
import { User } from '../user/interfaces/user.interface';
import { getCandidateFeedbackInterviewStatusBlockReason } from './candidate-feedback-eligibility';
import { CandidateFeedbackGenerationService } from './candidate-feedback-generation.service';
import { CandidateFeedbackShareService } from './candidate-feedback-share.service';
import { CandidateFeedbackService } from './candidate-feedback.service';
import {
  CandidateFeedbackShareLinkResponseDto,
  CandidateFeedbackShareLinkStatusResponseDto,
} from './dto/candidate-feedback-share-link.responses.dto';
import {
  CandidateFeedbackQuestionBlockDto,
  CandidateFeedbackResponseDto,
} from './dto/candidate-feedback.responses.dto';
import {
  GenerateAllCandidateFeedbackOverallResultDto,
  GenerateAllCandidateFeedbackQuestionResultDto,
  GenerateAllCandidateFeedbackResponseDto,
} from './dto/generate-all-candidate-feedback.response.dto';
import { CANDIDATE_FEEDBACK_GENERATE_SCOPES } from './dto/generate-candidate-feedback-query.dto';
import { GenerateCandidateFeedbackQueryDto } from './dto/generate-candidate-feedback-query.dto';
import { PatchCandidateFeedbackDto } from './dto/patch-candidate-feedback.dto';
import { presentCandidateFeedback } from './present-candidate-feedback';

@ApiTags('interviews')
@ApiCookieAuth('sessionAuth')
@ApiExtraModels(
  CandidateFeedbackResponseDto,
  CandidateFeedbackQuestionBlockDto,
  PatchCandidateFeedbackDto,
  GenerateAllCandidateFeedbackResponseDto,
  GenerateAllCandidateFeedbackQuestionResultDto,
  GenerateAllCandidateFeedbackOverallResultDto,
  CandidateFeedbackShareLinkResponseDto,
  CandidateFeedbackShareLinkStatusResponseDto,
)
@Controller('interviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CandidateFeedbackController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly candidateFeedbackGenerationService: CandidateFeedbackGenerationService,
    private readonly candidateFeedbackShareService: CandidateFeedbackShareService,
  ) {}

  @Get(':id/candidate-feedback')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary: 'Get candidate-facing feedback blocks for HR review',
    description:
      'Returns overall and per-question blocks with generation state and current texts.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiOkResponse({ type: CandidateFeedbackResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async getCandidateFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<CandidateFeedbackResponseDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    this.assertCandidateFeedbackInterviewReady(interview);
    const feedback =
      await this.candidateFeedbackService.syncQuestionsFromInterview(interview);
    return presentCandidateFeedback(feedback);
  }

  @Post(':id/candidate-feedback/share-link')
  @RequirePermissions('feedback:create_share_link')
  @ApiOperation({
    summary: 'Create a shareable candidate-feedback link',
    description:
      'Requires at least one accepted/edited block with publishable text. Revokes any previous active link for this interview.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiCreatedResponse({ type: CandidateFeedbackShareLinkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createCandidateFeedbackShareLink(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<CandidateFeedbackShareLinkResponseDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    this.assertCandidateFeedbackInterviewReady(interview);
    const { url, expiresAt } =
      await this.candidateFeedbackShareService.createLink(interviewId, {
        id: user.id,
        role: user.role,
        demo: user.demo,
      });
    return { url, expiresAt };
  }

  @Get(':id/candidate-feedback/share-link')
  @RequirePermissions('feedback:create_share_link')
  @ApiOperation({
    summary: 'Get active candidate-feedback share link status',
    description:
      'Returns expiresAt for a non-revoked, non-expired link that still has publishable feedback. Does not return the share URL (DB stores sha256 only). 404 when no usable active link exists.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiOkResponse({ type: CandidateFeedbackShareLinkStatusResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async getCandidateFeedbackShareLinkStatus(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<CandidateFeedbackShareLinkStatusResponseDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    this.assertCandidateFeedbackInterviewReady(interview);
    return this.candidateFeedbackShareService.getActiveLinkStatus(interviewId, {
      id: user.id,
      role: user.role,
      demo: user.demo,
    });
  }

  @Delete(':id/candidate-feedback/share-link')
  @RequirePermissions('feedback:revoke_share_link')
  @ApiOperation({
    summary: 'Revoke the active candidate-feedback share link',
    description:
      'Invalidates the current share URL without creating a replacement. Safe when a link was leaked and no new share is needed. Returns revoked=false when no active link existed.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiOkResponse({
    description: 'Revoke result',
    schema: {
      type: 'object',
      properties: {
        revoked: { type: 'boolean' },
      },
      required: ['revoked'],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async revokeCandidateFeedbackShareLink(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<{ revoked: boolean }> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    this.assertCandidateFeedbackInterviewReady(interview);
    return this.candidateFeedbackShareService.revokeActiveLink(interviewId, {
      id: user.id,
      role: user.role,
      demo: user.demo,
    });
  }

  @Patch(':id/candidate-feedback')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({
    summary: 'Update candidate-facing feedback texts and block states',
    description:
      'Partial update: HR may set recommendation/improvement texts and move blocks to accepted or edited.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiBody({ type: PatchCandidateFeedbackDto })
  @ApiOkResponse({ type: CandidateFeedbackResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async patchCandidateFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Body() dto: PatchCandidateFeedbackDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<CandidateFeedbackResponseDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    this.assertCandidateFeedbackInterviewReady(interview);
    await this.candidateFeedbackService.syncQuestionsFromInterview(interview);
    const feedback = await this.candidateFeedbackService.patchForHr(
      interviewId,
      dto,
    );
    return presentCandidateFeedback(feedback);
  }

  @Post(':id/candidate-feedback/generate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('interviews:update_own')
  @UseGuards(StaffAiThrottlerGuard)
  @Throttle({
    default: {
      limit: 10,
      ttl: minutes(5),
    },
  })
  @ApiOperation({
    summary: 'Generate candidate-facing feedback for the whole interview',
    description:
      'Starts generation in the background and returns immediately with queued/skipped plan. Eligibility skips (no answer, missing transcript, unusable transcript) prefill candidate-facing template text with state `edited` and no LLM call. If the selected answer version changed after validation, the question is skipped until AI evaluation is re-run for that version. Poll GET `/interviews/{id}/candidate-feedback` for `generating` → `generated` progress. Locked accepted/edited blocks are not overwritten.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiQuery({
    name: 'scope',
    required: true,
    enum: CANDIDATE_FEEDBACK_GENERATE_SCOPES,
    description: 'Generation scope. MVP supports only `all`.',
  })
  @ApiOkResponse({ type: GenerateAllCandidateFeedbackResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async generateAllCandidateFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Query() query: GenerateCandidateFeedbackQueryDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<GenerateAllCandidateFeedbackResponseDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    this.assertCandidateFeedbackInterviewReady(interview);
    return this.candidateFeedbackGenerationService.startGenerateAll(
      interview,
      query.scope,
    );
  }

  @Post(':id/candidate-feedback/questions/:questionIndex/generate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('interviews:update_own')
  @UseGuards(StaffAiThrottlerGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: minutes(5),
    },
  })
  @ApiOperation({
    summary: 'Generate candidate-facing feedback for one question',
    description:
      'Uses the current answer transcript and behaviorSignals to produce recommendationText and improvementText in interviewLocale. Eligibility skips prefill template text with state `edited` instead of calling the LLM. If the selected answer version changed after validation, re-run AI evaluation first so transcript/evaluation match the current take. Locked blocks (accepted/edited) are not overwritten.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiParam({ name: 'questionIndex', description: 'Zero-based question index' })
  @ApiOkResponse({ type: CandidateFeedbackQuestionBlockDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async generateQuestionFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<CandidateFeedbackQuestionBlockDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    this.assertCandidateFeedbackInterviewReady(interview);
    return this.candidateFeedbackGenerationService.generateQuestionBlock(
      interview,
      questionIndex,
    );
  }

  private assertCandidateFeedbackInterviewReady(interview: Interview): void {
    const blockReason = getCandidateFeedbackInterviewStatusBlockReason(
      interview.status,
    );
    if (blockReason) {
      throw apiConflict(ApiErrorCode.CONFLICT, blockReason, {
        interviewId: interview.id,
        status: interview.status,
      });
    }
  }
}
