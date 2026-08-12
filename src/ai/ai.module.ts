import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CandidateAiThrottlerGuard } from './guards/candidate-ai-throttler.guard';
import { StaffAiThrottlerGuard } from './guards/staff-ai-throttler.guard';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, CandidateAiThrottlerGuard, StaffAiThrottlerGuard],
  exports: [AiService],
})
export class AiModule {}
