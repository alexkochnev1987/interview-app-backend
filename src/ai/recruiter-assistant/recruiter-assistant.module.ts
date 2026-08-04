import { Module } from '@nestjs/common';
import { AuthGuardsModule } from '../../auth/auth-guards.module';
import { AuthModule } from '../../auth/auth.module';
import { FeedbackModule } from '../../feedback/feedback.module';
import { InterviewModule } from '../../interview/interview.module';
import { QuestionModule } from '../../question/question.module';
import { UserModule } from '../../user/user.module';
import { RecruiterPendingActionExecutorService } from './recruiter-pending-action-executor.service';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterConversationFlowService } from './recruiter-conversation-flow.service';
import { RecruiterAssistantController } from './recruiter-assistant.controller';
import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { RecruiterAssistantService } from './recruiter-assistant.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';
import { AiModule } from '../ai.module';
import { StaffAiThrottlerGuard } from '../guards/staff-ai-throttler.guard';

@Module({
  imports: [
    AuthModule,
    AuthGuardsModule,
    QuestionModule,
    InterviewModule,
    FeedbackModule,
    UserModule,
    AiModule,
  ],
  controllers: [RecruiterAssistantController],
  providers: [
    RecruiterAssistantIntentService,
    RecruiterAssistantToolsService,
    RecruiterAssistantService,
    RecruiterQuestionMatcherService,
    RecruiterPendingActionExecutorService,
    RecruiterPendingActionStore,
    RecruiterConversationStore,
    RecruiterConversationFlowService,
    StaffAiThrottlerGuard,
  ],
})
export class RecruiterAssistantModule {}
