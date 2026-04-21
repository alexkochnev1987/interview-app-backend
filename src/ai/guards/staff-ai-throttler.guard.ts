import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getRequestClientIp } from '../../rate-limit/request-tracker.util';

@Injectable()
export class StaffAiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;

    if (typeof userId === 'string' && userId.trim()) {
      return userId.trim();
    }

    return getRequestClientIp(req);
  }
}
