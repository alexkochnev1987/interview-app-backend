import { Module } from '@nestjs/common';
import { AuthGuardsModule } from '../../auth/auth-guards.module';
import { AuthModule } from '../../auth/auth.module';
import { InterviewModule } from '../../interview/interview.module';
import { QuestionModule } from '../../question/question.module';
import { RecruiterPendingActionExecutorService } from './recruiter-pending-action-executor.service';
import { RecruiterAssistantController } from './recruiter-assistant.controller';
import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { RecruiterAssistantService } from './recruiter-assistant.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

@Module({
  imports: [AuthModule, AuthGuardsModule, QuestionModule, InterviewModule],
  controllers: [RecruiterAssistantController],
  providers: [
    RecruiterAssistantIntentService,
    RecruiterAssistantToolsService,
    RecruiterAssistantService,
    RecruiterQuestionMatcherService,
    RecruiterPendingActionExecutorService,
  ],
})
export class RecruiterAssistantModule {}
