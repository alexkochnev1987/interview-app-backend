import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { QuestionModule } from '../question/question.module';
import { MediaCleanupModule } from '../upload/media-cleanup.module';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';

@Module({
  imports: [AuthModule, DatabaseModule, QuestionModule, MediaCleanupModule],
  controllers: [InterviewController],
  providers: [InterviewService, AnswerValidationWorkflowService],
  exports: [InterviewService, AnswerValidationWorkflowService],
})
export class InterviewModule {}
