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
import { InterviewService } from './interview.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { Interview, InterviewResult } from './interfaces/interview.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { AuthService } from '../auth/auth.service';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';

type ActingUser = Omit<User, 'passwordHash'>;

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
  async create(
    @Body() dto: CreateInterviewDto,
    @CurrentUser() user: ActingUser,
  ): Promise<Interview & { candidateLink: string }> {
    const interview = await this.interviewService.create(dto, {
      createdById: user.id,
    });
    const token = this.authService.generateCandidateToken(interview.id);
    return {
      ...interview,
      candidateLink: `/take/${interview.id}?token=${token}`,
    };
  }

  @Get()
  @RequirePermissions('interviews:read_own')
  findAll(@CurrentUser() user: ActingUser): Promise<Interview[]> {
    return this.interviewService.findAllForActor(user);
  }

  @Get(':id')
  @RequirePermissions('interviews:read_own')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<Interview> {
    return this.interviewService.findOneForActor(id, user);
  }

  @Post(':id/candidate-link')
  @RequirePermissions('interviews:assign')
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

  @Patch(':id/complete')
  @RequirePermissions('interviews:update_own')
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<Interview> {
    await this.interviewService.findOneForActor(id, user);
    return this.interviewService.complete(id);
  }

  @Post(':id/validate')
  @RequirePermissions('interviews:update_own')
  async validateAllAnswers(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ) {
    await this.interviewService.findOneForActor(id, user);
    return this.answerValidationWorkflowService.startValidationForAllSubmitted(
      id,
    );
  }

  @Post(':id/questions/:questionIndex/validate')
  @RequirePermissions('interviews:update_own')
  async validateAnswer(
    @Param('id') id: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
    @CurrentUser() user: ActingUser,
  ) {
    await this.interviewService.findOneForActor(id, user);
    return this.answerValidationWorkflowService.startValidation(
      id,
      questionIndex,
    );
  }

  @Get(':id/results')
  @RequirePermissions('interviews:read_own')
  async getResults(
    @Param('id') id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<InterviewResult> {
    await this.interviewService.findOneForActor(id, user);
    return this.interviewService.getResults(id);
  }
}
