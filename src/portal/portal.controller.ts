import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { apiForbidden } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { CandidateFeedbackShareService } from '../feedback/candidate-feedback-share.service';
import { CandidateFeedbackService } from '../feedback/candidate-feedback.service';
import { hasAnyPublishableCandidateFeedbackBlock } from '../feedback/present-public-candidate-feedback';
import { resolveMaxAnswerAttemptsPerQuestion } from '../interview/answer-attempt-rules';
import { getCandidatePortalAccessDenialReason } from '../interview/candidate-portal-interview-access';
import {
  ACTIVE_INTERVIEW_STATUSES,
  Interview,
  InterviewActor,
} from '../interview/interfaces/interview.interface';
import { isTerminalInterviewStatus } from '../interview/interview-management-rules';
import { InterviewService } from '../interview/interview.service';
import { User } from '../user/interfaces/user.interface';
import {
  CandidatePortalInterviewListItemDto,
  CandidatePortalInterviewResultsResponseDto,
} from './dto/portal.responses.dto';

type ActingUser = Omit<User, 'passwordHash'>;

function toInterviewActor(user: ActingUser): InterviewActor {
  return { id: user.id, role: user.role, demo: user.demo };
}

const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_INTERVIEW_STATUSES);

/**
 * Self-service surface for the Google-authenticated candidate portal.
 * Distinct from `take.controller.ts` (interview-scoped one-time-link tokens,
 * no `users` row involved) and from `InterviewController` (staff CRUD, gated
 * by created_by/assigned_hr ownership) — this controller scopes everything
 * to the authenticated candidate's own email via
 * `candidate-portal-interview-access.ts`.
 */
@ApiTags('portal')
@ApiCookieAuth('sessionAuth')
@Controller('portal')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PortalController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly candidateFeedbackShareService: CandidateFeedbackShareService,
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly authService: AuthService,
  ) {}

  @Get('interviews')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary: "List the authenticated candidate's own interviews",
    description:
      "Matched by candidate_email against the caller's account email. Excludes demo/internal data. Most relevant (active, then most recently updated) first.",
  })
  @ApiOkResponse({ type: [CandidatePortalInterviewListItemDto] })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listMyInterviews(
    @CurrentUser() user: ActingUser,
  ): Promise<CandidatePortalInterviewListItemDto[]> {
    const items = await this.interviewService.findAllForCandidateEmail(
      user.email,
      toInterviewActor(user),
    );

    const resultsReadyByInterviewId = await this.resolveResultsReadyMap(items);
    return items.map((item) =>
      this.toListItemDto(
        item,
        item.questionCount,
        resultsReadyByInterviewId.get(item.id) ?? false,
      ),
    );
  }

  @Get('interviews/:id')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary: "Get one of the authenticated candidate's own interviews",
    description:
      'Same shape and scoping as the list endpoint, for the interview-detail page.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CandidatePortalInterviewListItemDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getMyInterview(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<CandidatePortalInterviewListItemDto> {
    const interview = await this.interviewService.findOne(id);
    const denial = getCandidatePortalAccessDenialReason(interview, {
      role: user.role,
      email: user.email,
    });
    if (denial) {
      throw apiForbidden(ApiErrorCode.INSUFFICIENT_PERMISSIONS, denial);
    }

    const resultsReady = isTerminalInterviewStatus(interview.status)
      ? await this.isResultsReady(interview.id)
      : false;
    return this.toListItemDto(
      interview,
      interview.questions.length,
      resultsReady,
    );
  }

  @Get('interviews/:id/results')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary:
      "Get the authenticated candidate's own published feedback for one interview",
    description:
      "Reuses the same publishable-block eligibility as the HR-generated share link, but scoped by the caller's own email instead of a share token.",
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CandidatePortalInterviewResultsResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getMyInterviewResults(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<CandidatePortalInterviewResultsResponseDto> {
    return this.candidateFeedbackShareService.resolveForCandidateActor(id, {
      role: user.role,
      email: user.email,
    });
  }

  private toListItemDto(
    interview: Pick<
      Interview,
      'id' | 'position' | 'status' | 'createdAt' | 'updatedAt'
    >,
    questionCount: number,
    resultsReady: boolean,
  ): CandidatePortalInterviewListItemDto {
    const continueUrl = ACTIVE_STATUS_SET.has(interview.status)
      ? `/take/${interview.id}?token=${this.authService.generateCandidatePortalContinueToken(interview.id)}&from=portal`
      : undefined;

    return {
      id: interview.id,
      position: interview.position,
      status: interview.status,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
      questionCount,
      maxAnswerAttempts: resolveMaxAnswerAttemptsPerQuestion(),
      resultsReady,
      continueUrl,
    };
  }

  private async isResultsReady(interviewId: string): Promise<boolean> {
    const feedback =
      await this.candidateFeedbackService.findByInterviewId(interviewId);
    return feedback ? hasAnyPublishableCandidateFeedbackBlock(feedback) : false;
  }

  /**
   * Batched `isResultsReady` for the list endpoint: one query for every
   * terminal interview's feedback instead of one round trip per row.
   */
  private async resolveResultsReadyMap(
    interviews: Pick<Interview, 'id' | 'status'>[],
  ): Promise<Map<string, boolean>> {
    const terminalIds = interviews
      .filter((interview) => isTerminalInterviewStatus(interview.status))
      .map((interview) => interview.id);

    const feedbackByInterviewId =
      await this.candidateFeedbackService.findByInterviewIds(terminalIds);

    const result = new Map<string, boolean>();
    for (const id of terminalIds) {
      const feedback = feedbackByInterviewId.get(id);
      result.set(
        id,
        feedback ? hasAnyPublishableCandidateFeedbackBlock(feedback) : false,
      );
    }
    return result;
  }
}
