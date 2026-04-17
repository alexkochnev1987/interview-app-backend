import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InterviewService } from './interview.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { Interview, InterviewResult } from './interfaces/interview.interface';

@Controller('interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post()
  create(@Body() dto: CreateInterviewDto): Interview {
    return this.interviewService.create(dto);
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
  getResults(@Param('id') id: string): InterviewResult {
    return this.interviewService.getResults(id);
  }
}
