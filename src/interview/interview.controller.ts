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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { AuthService } from '../auth/auth.service';
import { User } from '../user/interfaces/user.interface';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { QueryInterviewsDto } from './dto/query-interviews.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { MarkInterviewDemoResponseDto } from './dto/mark-interview-demo.response.dto';
import {
  CandidateLinkResponseDto,
  InterviewCancelResponseDto,
  InterviewFacetsResponseDto,
  InterviewResponseDto,
  InterviewResultResponseDto,
  InterviewWithCandidateLinkResponseDto,
  PaginatedInterviewsResponseDto,
  StartAllAnswerValidationsResponseDto,
  StartAnswerValidationResultDto,
} from './dto/interview.responses.dto';
import {
  Interview,
  InterviewCancelResult,
  InterviewResult,
} from './interfaces/interview.interface';
import {
  InterviewFacets,
  InterviewService,
  PaginatedInterviews,
} from './interview.service';

type ActingUser = Omit<User, 'passwordHash'>;

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
  @ApiOperation({ summary: 'Create interview' })
  @ApiBody({ type: CreateInterviewDto })
  @ApiOkResponse({ type: InterviewWithCandidateLinkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async create(
    @Body() dto: CreateInterviewDto,
    @CurrentUser() user: ActingUser,
  ): Promise<Interview & { candidateLink: string }> {
    const interview = await this.interviewService.create(dto, {
      createdById: user.id,
      demo: user.demo,
    });
    const token = this.authService.generateCandidateToken(interview.id);
    return {
      ...interview,
      candidateLink: `/take/${interview.id}?token=${token}`,
    };
  }

  @Get()
  @RequirePermissions('interviews:read_own')
  @ApiOperation({ summary: 'List interviews (paginated, filterable, sortable)' })
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
      'Returns position and status counts. Counts respect every other filter on the request (q, and the other facet) so the UI shows what is still available before clicking.',
  })
  @ApiOkResponse({ type: InterviewFacetsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  getFacets(
    @Query(INTERVIEW_QUERY_VALIDATION_PIPE) query: QueryInterviewsDto,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewFacets> {
    return this.interviewService.getFacets(query, user);
  }

  @Get(':id')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({ summary: 'Get interview by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<Interview> {
    return this.interviewService.findOneForActor(id, user);
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
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewCancelResult> {
    await this.interviewService.findOneForActor(id, user);
    return this.interviewService.cancel(id);
  }

  @Patch(':id/complete')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({ summary: 'Complete interview' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<Interview> {
    await this.interviewService.findOneForActor(id, user);
    return this.interviewService.complete(id);
  }

  @Patch(':id')
  @RequirePermissions('interviews:update_own')
  @ApiOperation({ summary: 'Update pending interview' })
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
    await this.interviewService.findOneForActor(id, user);
    return this.interviewService.update(id, dto);
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
  @ApiOperation({ summary: 'Mark an interview as the demo interview', description: 'Admin-only. Flips the interview to demo and reassigns it to the demo account, removes the fabricated placeholder demo interview and demotes any other completed demo interview so exactly the marked completed interview plus the seeded pending one remain. Re-running the demo provisioning afterwards will not recreate the placeholder. Refused on production unless ALLOW_DEMO_SEED=true is set.' })
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
  @ApiOperation({ summary: 'Get interview results' })
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
