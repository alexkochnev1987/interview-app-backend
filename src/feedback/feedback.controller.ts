import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { LoginThrottlerGuard } from '../auth/guards/login-throttler.guard';
import { FeedbackService } from './feedback.service';
import { FeedbackResponse } from './interfaces/feedback-link.interface';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest } from '../common/errors/api-error';
import { FeedbackResponseDto } from './dto/feedback.response.dto';

@ApiTags('feedback')
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
  @ApiOperation({
    summary: 'Get interview feedback using a share link',
    description:
      'Returns AI feedback in the interview single locale (interviewLocale). ' +
      'generalFeedback, improvements and per-question summaries are single-locale in v1.',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiQuery({ name: 'token', description: 'Access token from the share link' })
  @ApiOkResponse({ type: FeedbackResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async getFeedback(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Query('token') token: string,
  ): Promise<FeedbackResponse> {
    if (!token) {
      throw apiBadRequest(ApiErrorCode.BAD_REQUEST, 'Token is required');
    }
    return this.feedbackService.resolveByToken(interviewId, token);
  }
}
