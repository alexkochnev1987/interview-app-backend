import { Controller, Get, Post, Param, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { CandidateAuthGuard } from '../auth/guards/candidate-auth.guard';
import { InterviewService } from '../interview/interview.service';

@Controller('take')
@UseGuards(CandidateAuthGuard)
export class TakeController {
  constructor(private readonly interviewService: InterviewService) {}

  @Get(':id')
  getInterview(@Param('id') id: string, @Req() req: { candidatePayload: { interviewId: string } }) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    const interview = this.interviewService.findOne(id);
    if (!interview) {
      throw new BadRequestException('Interview not found');
    }

    // Return only what candidate needs — one question at a time
    const answeredCount = interview.answers.length;
    const totalQuestions = interview.questions.length;

    if (answeredCount >= totalQuestions) {
      return {
        id: interview.id,
        position: interview.position,
        candidateName: interview.candidateName,
        status: interview.status,
        totalQuestions,
        currentQuestion: null,
        currentQuestionIndex: answeredCount,
        completed: true,
      };
    }

    return {
      id: interview.id,
      position: interview.position,
      candidateName: interview.candidateName,
      status: interview.status,
      totalQuestions,
      currentQuestion: interview.questions[answeredCount],
      currentQuestionIndex: answeredCount,
      completed: false,
    };
  }

  @Post(':id/answer')
  submitAnswer(
    @Param('id') id: string,
    @Body() body: { questionIndex: number; mediaKey: string },
    @Req() req: { candidatePayload: { interviewId: string } },
  ) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    const interview = this.interviewService.findOne(id);
    if (!interview) {
      throw new BadRequestException('Interview not found');
    }

    if (body.questionIndex !== interview.answers.length) {
      throw new BadRequestException('Invalid question index — must answer in order');
    }

    interview.answers.push({
      questionIndex: body.questionIndex,
      mediaKey: body.mediaKey,
      uploadedAt: new Date(),
    });
    interview.status = 'in_progress';
    interview.updatedAt = new Date();

    const isLast = interview.answers.length >= interview.questions.length;
    return {
      ok: true,
      answeredCount: interview.answers.length,
      totalQuestions: interview.questions.length,
      completed: isLast,
    };
  }
}
