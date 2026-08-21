import { Module } from '@nestjs/common';

import { AuthGuardsModule } from '../auth/auth-guards.module';
import { AuthModule } from '../auth/auth.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { InterviewModule } from '../interview/interview.module';
import { PortalController } from './portal.controller';

@Module({
  imports: [AuthModule, AuthGuardsModule, InterviewModule, FeedbackModule],
  controllers: [PortalController],
})
export class PortalModule {}
