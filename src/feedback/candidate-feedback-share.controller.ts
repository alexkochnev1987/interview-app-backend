import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';

import { LoginThrottlerGuard } from '../auth/guards/login-throttler.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { CandidateFeedbackShareService } from './candidate-feedback-share.service';
import { PublicCandidateFeedbackResponseDto } from './dto/candidate-feedback-share-link.responses.dto';
import { PublicCandidateFeedbackResponse } from './interfaces/candidate-feedback-share-link.interface';

/**
 * Public candidate-feedback share resolve.
 * Mounted at `feedback/share` so it does not collide with scoring
 * `GET /feedback/:id`.
 */
@ApiTags('feedback')
@Controller('feedback/share')
@UseGuards(LoginThrottlerGuard)
@Throttle({
  default: {
    limit: 30,
    ttl: minutes(1),
    blockDuration: minutes(5),
  },
})
export class CandidateFeedbackShareController {
  constructor(
    private readonly candidateFeedbackShareService: CandidateFeedbackShareService,
  ) {}

  @Get(':token')
  @ApiOperation({
    summary: 'Get published candidate feedback using a share token',
    description:
      'Public endpoint (no JWT). Returns only accepted/edited blocks with publishable text. Invalid, expired, or revoked tokens yield 404.',
  })
  @ApiParam({
    name: 'token',
    description: 'Plaintext share token from the candidate-feedback share URL',
  })
  @ApiOkResponse({ type: PublicCandidateFeedbackResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getSharedCandidateFeedback(
    @Param('token') token: string,
  ): Promise<PublicCandidateFeedbackResponse> {
    return this.candidateFeedbackShareService.resolveByToken(token);
  }
}
