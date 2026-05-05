import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  getRequestClientIp,
  type RequestTrackerRequest,
} from '../../rate-limit/request-tracker.util';

/**
 * Separate bucket from `LoginThrottlerGuard` so that registration attempts
 * cannot exhaust the login budget (and vice versa). The `register:` prefix
 * keys this bucket independently in the underlying throttler storage.
 */
@Injectable()
export class RegisterThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestTrackerRequest): Promise<string> {
    return `register:${getRequestClientIp(req)}`;
  }
}
