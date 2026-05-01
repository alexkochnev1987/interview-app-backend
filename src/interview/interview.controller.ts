import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InterviewService } from './interview.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { Interview, InterviewResult } from './interfaces/interview.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthService } from '../auth/auth.service';

@Controller('interviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin', 'hr')
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
  ) {}

  @Post()
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
  findAll(): Promise<Interview[]> {
    return this.interviewService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Interview> {
    return this.interviewService.findOne(id);
  }

  @Post(':id/candidate-link')
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
  complete(@Param('id') id: string): Promise<Interview> {
    return this.interviewService.complete(id);
  }

  @Get(':id/results')
  @Roles('super_admin', 'admin')
  getResults(@Param('id') id: string): Promise<InterviewResult> {
    return this.interviewService.getResults(id);
  }
}
