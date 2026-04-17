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
  create(@Body() dto: CreateInterviewDto): Interview & { candidateLink: string } {
    const interview = this.interviewService.create(dto);
    const token = this.authService.generateCandidateToken(interview.id);
    return {
      ...interview,
      candidateLink: `/take/${interview.id}?token=${token}`,
    };
  }

  @Get()
  findAll(): Interview[] {
    return this.interviewService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Interview {
    return this.interviewService.findOne(id);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string): Interview {
    return this.interviewService.complete(id);
  }

  @Get(':id/results')
  @Roles('super_admin', 'admin')
  getResults(@Param('id') id: string): InterviewResult {
    return this.interviewService.getResults(id);
  }
}
