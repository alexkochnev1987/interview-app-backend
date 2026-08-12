import { Module } from '@nestjs/common';

import { AuthGuardsModule } from '../../auth/auth-guards.module';
import { AuthModule } from '../../auth/auth.module';
import { FeedbackModule } from '../../feedback/feedback.module';
import { InterviewModule } from '../../interview/interview.module';
import { QuestionModule } from '../../question/question.module';
import { TemplateModule } from '../../template/template.module';
import { UserModule } from '../../user/user.module';
import { AiModule } from '../ai.module';
import { StaffAiThrottlerGuard } from '../guards/staff-ai-throttler.guard';
import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterAssistantController } from './recruiter-assistant.controller';
import { RecruiterAssistantService } from './recruiter-assistant.service';
import { RecruiterConversationFlowService } from './recruiter-conversation-flow.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionExecutorService } from './recruiter-pending-action-executor.service';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

@Module({
  imports: [
    AuthModule,
    AuthGuardsModule,
    QuestionModule,
    InterviewModule,
    FeedbackModule,
    UserModule,
    AiModule,
    TemplateModule,
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
