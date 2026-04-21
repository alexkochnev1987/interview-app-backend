import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AuthModule } from '../auth/auth.module';
import { InterviewModule } from '../interview/interview.module';

@Module({
  imports: [AuthModule, InterviewModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
