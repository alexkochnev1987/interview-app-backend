import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { InterviewService } from '../interview/interview.service';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { CandidateFeedbackService } from './candidate-feedback.service';
import { CandidateFeedbackGenerationService } from './candidate-feedback-generation.service';
import {
  CandidateFeedbackQuestionBlockDto,
  CandidateFeedbackResponseDto,
} from './dto/candidate-feedback.responses.dto';
import { PatchCandidateFeedbackDto } from './dto/patch-candidate-feedback.dto';
import { CANDIDATE_FEEDBACK_GENERATE_SCOPES } from './dto/generate-candidate-feedback-query.dto';
import { GenerateCandidateFeedbackQueryDto } from './dto/generate-candidate-feedback-query.dto';
import {
  GenerateAllCandidateFeedbackOverallResultDto,
  GenerateAllCandidateFeedbackQuestionResultDto,
  GenerateAllCandidateFeedbackResponseDto,
} from './dto/generate-all-candidate-feedback.response.dto';
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
)
@Controller('interviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CandidateFeedbackController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly candidateFeedbackService: CandidateFeedbackService,
    private readonly candidateFeedbackGenerationService: CandidateFeedbackGenerationService,
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
  async getCandidateFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<CandidateFeedbackResponseDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
    const feedback =
      await this.candidateFeedbackService.syncQuestionsFromInterview(interview);
    return presentCandidateFeedback(feedback);
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
  async patchCandidateFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Body() dto: PatchCandidateFeedbackDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<CandidateFeedbackResponseDto> {
    const interview = await this.interviewService.findOneForActor(
      interviewId,
      user,
    );
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
  @ApiOperation({
    summary: 'Generate candidate-facing feedback for the whole interview',
    description:
      'Loops question blocks sequentially (skips accepted/edited), then regenerates overall from best-available per-question texts. Overall accepted/edited blocks are not overwritten.',
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
    return this.candidateFeedbackGenerationService.generateAll(interview);
  }

  @Post(':id/candidate-feedback/questions/:questionIndex/generate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('interviews:update_own')
  @ApiOperation({
    summary: 'Generate candidate-facing feedback for one question',
    description:
      'Uses answer.transcript.text and behaviorSignals to produce recommendationText and improvementText in interviewLocale. Locked blocks (accepted/edited) are not overwritten.',
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
    return this.candidateFeedbackGenerationService.generateQuestionBlock(
      interview,
      questionIndex,
    );
  }
}
