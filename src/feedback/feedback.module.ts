import { Module } from '@nestjs/common';
import { StaffAiThrottlerGuard } from '../ai/guards/staff-ai-throttler.guard';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { InterviewModule } from '../interview/interview.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackLinkController } from './feedback-link.controller';
import { CandidateFeedbackController } from './candidate-feedback.controller';
import { CandidateFeedbackShareController } from './candidate-feedback-share.controller';
import { CandidateFeedbackGenerationService } from './candidate-feedback-generation.service';
import { CandidateFeedbackService } from './candidate-feedback.service';
import { CandidateFeedbackShareService } from './candidate-feedback-share.service';
import { FeedbackService } from './feedback.service';

@Module({
  // `AuthModule` is still required because public feedback controllers run under
  // `LoginThrottlerGuard` (provided by AuthModule). Token generation/validation
  // for share links lives in the feedback share services.
  imports: [DatabaseModule, AuthGuardsModule, AuthModule, InterviewModule],
  controllers: [
    // Register `feedback/share` before `feedback/:id` for clarity; paths do not
    // overlap (`feedback/share/:token` vs `feedback/:id`).
    CandidateFeedbackShareController,
    FeedbackController,
    FeedbackLinkController,
    CandidateFeedbackController,
  ],
  providers: [
    FeedbackService,
    CandidateFeedbackService,
    CandidateFeedbackShareService,
    CandidateFeedbackGenerationService,
    StaffAiThrottlerGuard,
  ],
  exports: [CandidateFeedbackService, CandidateFeedbackShareService],
})
export class FeedbackModule {}
