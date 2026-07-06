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
  ApiExtraModels,
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
import { Locale } from '../locale/locale.constants';
import { InterviewService } from './interview.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { ListInterviewsQueryDto } from './dto/list-interviews-query.dto';
import {
  Interview,
  InterviewCancelResult,
  InterviewResult,
} from './interfaces/interview.interface';
import { InterviewPresentation, presentInterview } from './present-interview';
import { presentInterviewListItem } from './present-interview-list';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { AuthService } from '../auth/auth.service';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';
import {
  CreateInterviewResultDto,
  CandidateLinkResponseDto,
  InterviewCancelResponseDto,
  InterviewResponseDto,
  InterviewResultResponseDto,
  PaginatedInterviewListResponseDto,
  StartAllAnswerValidationsResponseDto,
  StartAnswerValidationResultDto,
} from './dto/interview.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { MarkInterviewDemoResponseDto } from './dto/mark-interview-demo.response.dto';

type ActingUser = Omit<User, 'passwordHash'>;

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
  ): Promise<InterviewPresentation & { candidateLink: string; localeWarnings: Array<{ questionId: string; availableLocales: Locale[] }> }> {
    const created = await this.interviewService.create(dto, {
      createdById: user.id,
      demo: user.demo,
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
  @ApiExtraModels(InterviewResponseDto, PaginatedInterviewListResponseDto)
  @ApiOperation({
    summary: 'List interviews',
    description:
      'Default: JSON array with full questions[] (legacy clients). ' +
      'Pass paginated=true for { items, total, page, limit } with lightweight questionsPreview. ' +
      'questions[]/questionsPreview are resolved in interviewLocale.',
  })
  @ApiOkResponse({
    description: 'Array when paginated is false/omitted; paginated object when paginated=true',
    schema: {
      oneOf: [
        { type: 'array', items: { $ref: '#/components/schemas/InterviewResponseDto' } },
        { $ref: '#/components/schemas/PaginatedInterviewListResponseDto' },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async findAll(
    @Query(new ValidationPipe({ transform: true })) query: ListInterviewsQueryDto,
    @CurrentUser() user: ActingUser,
  ): Promise<PaginatedInterviewListResponseDto | InterviewPresentation[]> {
    if (query.paginated) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;
      const result = await this.interviewService.findAllForActor(user, {
        page,
        limit,
      });
      return {
        items: result.items.map((interview) =>
          presentInterviewListItem(interview),
        ),
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    }

    const result = await this.interviewService.findAllForActor(user, {
      unbounded: true,
    });
    return result.items.map((interview) => presentInterview(interview));
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
