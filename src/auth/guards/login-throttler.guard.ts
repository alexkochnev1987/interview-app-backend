import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  getRequestClientIp,
  type RequestTrackerRequest,
} from '../../rate-limit/request-tracker.util';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestTrackerRequest): Promise<string> {
    return getRequestClientIp(req);
  }
}
