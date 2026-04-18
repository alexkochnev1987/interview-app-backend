import { Controller, Get, Post, Param, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { CandidateAuthGuard } from '../auth/guards/candidate-auth.guard';
import { InterviewService } from '../interview/interview.service';
import { CandidateQuestionView } from '../interview/interfaces/interview.interface';

@Controller('take')
@UseGuards(CandidateAuthGuard)
export class TakeController {
  constructor(private readonly interviewService: InterviewService) {}

  @Get(':id')
  async getInterview(
    @Param('id') id: string,
    @Req() req: { candidatePayload: { interviewId: string } },
  ) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    const interview = await this.interviewService.findOne(id);

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

    const currentQuestion: CandidateQuestionView = {
      text: interview.questions[answeredCount].text,
    };

    return {
      id: interview.id,
      position: interview.position,
      candidateName: interview.candidateName,
      status: interview.status,
      totalQuestions,
      currentQuestion,
      currentQuestionIndex: answeredCount,
      completed: false,
    };
  }

  @Post(':id/answer')
  async submitAnswer(
    @Param('id') id: string,
    @Body() body: { questionIndex: number; mediaKey: string },
    @Req() req: { candidatePayload: { interviewId: string } },
  ) {
    if (req.candidatePayload.interviewId !== id) {
      throw new BadRequestException('Token does not match interview');
    }

    const interview = await this.interviewService.addAnswer(
      id,
      body.questionIndex,
      body.mediaKey,
    );

    const isLast = interview.answers.length >= interview.questions.length;
    return {
      ok: true,
      answeredCount: interview.answers.length,
      totalQuestions: interview.questions.length,
      completed: isLast,
    };
  }
}
