import { Module } from '@nestjs/common';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { InterviewModule } from '../interview/interview.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackLinkController } from './feedback-link.controller';
import { FeedbackService } from './feedback.service';

@Module({
  // `AuthModule` is still required because `FeedbackController` runs under
  // `LoginThrottlerGuard` (provided by AuthModule). Token generation/validation
  // for feedback links lives entirely in `FeedbackService`.
  imports: [DatabaseModule, AuthGuardsModule, AuthModule, InterviewModule],
  controllers: [FeedbackController, FeedbackLinkController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
