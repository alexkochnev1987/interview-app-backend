import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from '../auth/auth.module';
import { CandidateAiThrottlerGuard } from './guards/candidate-ai-throttler.guard';
import { StaffAiThrottlerGuard } from './guards/staff-ai-throttler.guard';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, CandidateAiThrottlerGuard, StaffAiThrottlerGuard],
  exports: [AiService],
})
export class AiModule {}
