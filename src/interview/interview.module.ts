import {forwardRef, Module} from '@nestjs/common';
import { UploadModule } from '../upload/upload.module'
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { QuestionModule } from '../question/question.module';
import { AnswerValidationWorkflowService } from './answer-validation-workflow.service';

@Module({
  imports: [AuthModule, DatabaseModule, QuestionModule, forwardRef(()=> UploadModule)],
  controllers: [InterviewController],
  providers: [InterviewService, AnswerValidationWorkflowService],
  exports: [InterviewService, AnswerValidationWorkflowService],
})
export class InterviewModule {}
