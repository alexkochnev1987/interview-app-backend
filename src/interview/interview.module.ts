import { Module } from '@nestjs/common';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { QuestionModule } from '../question/question.module';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';
import { AnswerValidationWorkflowController } from './answer-validation-workflow.controller';

@Module({
  imports: [AuthModule, DatabaseModule, QuestionModule],
  controllers: [InterviewController, AnswerValidationWorkflowController],
  providers: [InterviewService, AnswerValidationWorkflowService],
  exports: [InterviewService, AnswerValidationWorkflowService],
})
export class InterviewModule {}
