import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  getRequestClientIp,
  type RequestTrackerRequest,
} from '../../rate-limit/request-tracker.util';

@Injectable()
export class CandidateAiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestTrackerRequest): Promise<string> {
    const interviewId = req.candidatePayload?.interviewId;

    if (typeof interviewId === 'string' && interviewId.trim()) {
      return interviewId.trim();
    }

    return getRequestClientIp(req);
  }
}
