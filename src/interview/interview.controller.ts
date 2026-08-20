import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
  Delete,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { Locale } from '../locale/locale.constants';
import { ActingUser } from '../user/interfaces/user.interface';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import {
  CreateInterviewResultDto,
  CandidateLinkResponseDto,
  InterviewCancelResponseDto,
  InterviewFacetsResponseDto,
  InterviewResponseDto,
  InterviewResultResponseDto,
  PaginatedInterviewsResponseDto,
  StartAllAnswerValidationsResponseDto,
  StartAnswerValidationResultDto,
  InterviewDeleteResponseDto,
} from './dto/interview.responses.dto';
import { MarkInterviewDemoResponseDto } from './dto/mark-interview-demo.response.dto';
import { QueryInterviewsDto } from './dto/query-interviews.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import {
  Interview,
  InterviewCancelResult,
  InterviewDeleteResult,
  InterviewResult,
  INTERVIEW_STATUSES,
} from './interfaces/interview.interface';
import { toInterviewActor } from './interview-actor';
import {
  InterviewFacets,
  InterviewService,
  PaginatedInterviews,
} from './interview.service';
import { parseInterviewFacetsQuery } from './parse-interview-facets-query';
import { InterviewPresentation, presentInterview } from './present-interview';

const INTERVIEW_QUERY_VALIDATION_PIPE = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
});

@ApiTags('interviews')
@ApiCookieAuth('sessionAuth')
@Controller('interviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly answerValidationWorkflowService: AnswerValidationWorkflowService,
  ) {}

  @Post()
  @RequirePermissions('interviews:create')
  @ApiOperation({
    summary: 'Create interview',
    description:
      'Question snapshots in the response are resolved for interviewLocale. ' +
      'If some selected questions have no translation for interviewLocale, creation still succeeds and `localeWarnings` is returned.',
  })
  @ApiBody({ type: CreateInterviewDto })
  @ApiOkResponse({ type: CreateInterviewResultDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async create(
    @Body() dto: CreateInterviewDto,
    @CurrentUser() user: ActingUser,
  ): Promise<
    InterviewPresentation & {
      candidateLink: string;
      localeWarnings: Array<{ questionId: string; availableLocales: Locale[] }>;
    }
  > {
    const created = await this.interviewService.create(dto, {
      createdById: user.id,
      demo: user.demo,
      actor: toInterviewActor(user),
    });
    const token = this.authService.generateCandidateToken(created.interview.id);
    return {
      ...presentInterview(created.interview),
      candidateLink: `/take/${created.interview.id}?token=${token}`,
      localeWarnings: created.localeWarnings,
    };
  }

  @Get()
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary: 'List interviews (paginated, filterable, sortable)',
    description:
      'Always returns { items, total, page, limit } with slim InterviewListItem rows. ' +
      'The legacy `paginated` query flag is accepted but ignored for backward compatibility. ' +
      'Plain-array responses from older clients are no longer supported on this endpoint.',
  })
  @ApiOkResponse({ type: PaginatedInterviewsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  findAll(
    @Query(INTERVIEW_QUERY_VALIDATION_PIPE) query: QueryInterviewsDto,
    @CurrentUser() user: ActingUser,
  ): Promise<PaginatedInterviews> {
    return this.interviewService.findAllPaginated(query, user);
  }

  @Get('facets')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary: 'Faceted counts for the interview list sidebar',
    description:
      'Returns total question volume plus position and status counts. Facet counts respect every other filter on the request (q, and the other facet) so the UI shows what is still available before clicking. totalQuestionCount sums questions across interviews matching all current filters.',
  })
  @ApiOkResponse({ type: InterviewFacetsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search by candidates name',
  })
  @ApiQuery({
    name: 'position',
    required: false,
    type: String,
    description: 'Filter by position (exact match)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: INTERVIEW_STATUSES,
  })
  @ApiQuery({
    name: 'assignedHrId',
    required: false,
    type: String,
    description:
      'Filter by assigned HR reviewer UUID, or the literal `unassigned` for interviews with no assignee.',
  })
  getFacets(
    @Query() rawQuery: Record<string, unknown>,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewFacets> {
    const query = parseInterviewFacetsQuery(rawQuery);
    return this.interviewService.getFacets(query, user);
  }

  @Get(':id')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary: 'Get interview by id',
    description: 'questions[] resolved for interviewLocale.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewPresentation> {
    const interview = await this.interviewService.findOneForActor(id, user);
    return presentInterview(interview);
  }

  @Post(':id/candidate-link')
  @RequirePermissions('interviews:assign')
  @ApiOperation({ summary: 'Generate candidate interview link' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: CandidateLinkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async generateCandidateLink(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<{ candidateLink: string }> {
    await this.interviewService.findOneForActor(id, user);
    const token = this.authService.generateCandidateToken(id);
    return {
      candidateLink: `/take/${id}?token=${token}`,
    };
  }

  @Patch(':id/cancel')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({ summary: 'Cancel pending interview' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewCancelResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewCancelResult> {
    return this.interviewService.cancel(id, toInterviewActor(user));
  }

  @Delete(':id')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({ summary: 'Delete completed or failed interview' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewDeleteResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async deleteCompleted(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewDeleteResult> {
    return this.interviewService.deleteCompleted(id, toInterviewActor(user));
  }

  @Patch(':id/complete')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({
    summary: 'Complete interview',
    description: 'Response questions[] resolved for interviewLocale.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewPresentation> {
    await this.interviewService.findOneForActor(id, user);
    const interview = await this.interviewService.complete(id);
    return presentInterview(interview);
  }

  @Patch(':id')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({
    summary: 'Update interview',
    description:
      'Candidate details and questions can only be changed while pending. HR assignment can be changed in any status (admin/super_admin only).',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateInterviewDto })
  @ApiOkResponse({ type: InterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
    @CurrentUser() user: ActingUser,
  ): Promise<Interview> {
    return this.interviewService.update(id, dto, toInterviewActor(user));
  }

  @Post(':id/validate')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({ summary: 'Start validation for all submitted answers' })
  @ApiParam({ name: 'id' })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description:
      'Re-evaluate answers whose latest validation already completed. Defaults to false; in-flight validations always return 409.',
  })
  @ApiOkResponse({ type: StartAllAnswerValidationsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async validateAllAnswers(
    @Param('id') id: string,
    @Query('force', new DefaultValuePipe(false), ParseBoolPipe) force: boolean,
    @CurrentUser() user: ActingUser,
  ) {
    await this.interviewService.findOneForActor(id, user);
    return this.answerValidationWorkflowService.startValidationForAllSubmitted(
      id,
      force,
    );
  }

  @Post(':id/questions/:questionIndex/validate')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({ summary: 'Start validation for single answer' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'questionIndex' })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description:
      'Re-evaluate the answer if its latest validation already completed. Defaults to false; in-flight validations always return 409.',
  })
  @ApiOkResponse({ type: StartAnswerValidationResultDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async validateAnswer(
    @Param('id') id: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
    @Query('force', new DefaultValuePipe(false), ParseBoolPipe) force: boolean,
    @CurrentUser() user: ActingUser,
  ) {
    await this.interviewService.findOneForActor(id, user);
    return this.answerValidationWorkflowService.startValidation(
      id,
      questionIndex,
      force,
    );
  }

  @Post(':id/mark-demo')
  @RequirePermissions('users:assign_role')
  @ApiOperation({
    summary: 'Mark an interview as the demo interview',
    description:
      'Admin-only. Flips the interview to demo and reassigns it to the demo account, removes the fabricated placeholder demo interview and demotes any other completed demo interview so exactly the marked completed interview plus the seeded pending one remain. Re-running the demo provisioning afterwards will not recreate the placeholder. Refused on production unless ALLOW_DEMO_SEED=true is set.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: MarkInterviewDemoResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  markDemo(@Param('id') id: string) {
    return this.interviewService.markAsDemo(id);
  }

  @Get(':id/results')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({
    summary: 'Get interview results',
    description:
      'Returns single-locale AI result content in interviewLocale (not X-Locale).',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResultResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getResults(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewResult> {
    await this.interviewService.findOneForActor(id, user);
    return this.interviewService.getResults(id);
  }
}
