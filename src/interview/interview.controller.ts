import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InterviewService } from './interview.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { Interview, InterviewResult } from './interfaces/interview.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';
import {
  CandidateLinkResponseDto,
  InterviewResponseDto,
  InterviewResultResponseDto,
  InterviewWithCandidateLinkResponseDto,
  StartAllAnswerValidationsResponseDto,
  StartAnswerValidationResultDto,
} from './dto/interview.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

@ApiTags('interviews')
@Controller('interviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin', 'hr')
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly answerValidationWorkflowService: AnswerValidationWorkflowService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create interview' })
  @ApiBody({ type: CreateInterviewDto })
  @ApiOkResponse({ type: InterviewWithCandidateLinkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async create(
    @Body() dto: CreateInterviewDto,
  ): Promise<Interview & { candidateLink: string }> {
    const interview = await this.interviewService.create(dto);
    const token = this.authService.generateCandidateToken(interview.id);
    return {
      ...interview,
      candidateLink: `/take/${interview.id}?token=${token}`,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List interviews' })
  @ApiOkResponse({ type: [InterviewResponseDto] })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  findAll(): Promise<Interview[]> {
    return this.interviewService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get interview by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(@Param('id') id: string): Promise<Interview> {
    return this.interviewService.findOne(id);
  }

  @Post(':id/candidate-link')
  @ApiOperation({ summary: 'Generate candidate interview link' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: CandidateLinkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async generateCandidateLink(
    @Param('id') id: string,
  ): Promise<{ candidateLink: string }> {
    await this.interviewService.findOne(id);
    const token = this.authService.generateCandidateToken(id);
    return {
      candidateLink: `/take/${id}?token=${token}`,
    };
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete interview' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  complete(@Param('id') id: string): Promise<Interview> {
    return this.interviewService.complete(id);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Start validation for all submitted answers' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: StartAllAnswerValidationsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async validateAllAnswers(@Param('id') id: string) {
    return this.answerValidationWorkflowService.startValidationForAllSubmitted(
      id,
    );
  }

  @Post(':id/questions/:questionIndex/validate')
  @ApiOperation({ summary: 'Start validation for single answer' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'questionIndex' })
  @ApiOkResponse({ type: StartAnswerValidationResultDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async validateAnswer(
    @Param('id') id: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
  ) {
    return this.answerValidationWorkflowService.startValidation(
      id,
      questionIndex,
    );
  }

  @Get(':id/results')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get interview results' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: InterviewResultResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getResults(@Param('id') id: string): Promise<InterviewResult> {
    return this.interviewService.getResults(id);
  }
}
