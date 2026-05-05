import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { LoginThrottlerGuard } from '../auth/guards/login-throttler.guard';
import { FeedbackService } from './feedback.service';
import { FeedbackResponse } from './interfaces/feedback-link.interface';

@Controller('feedback')
@UseGuards(LoginThrottlerGuard)
@Throttle({
  default: {
    limit: 30,
    ttl: minutes(1),
    blockDuration: minutes(5),
  },
})
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get(':id')
  async getFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Query('token') token: string,
  ): Promise<FeedbackResponse> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    return this.feedbackService.resolveByToken(interviewId, token);
  }
}
