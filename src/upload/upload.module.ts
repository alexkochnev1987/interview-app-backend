import { forwardRef, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InterviewModule } from '../interview/interview.module';
import { MediaCleanupModule } from './media-cleanup.module';
import { RecruiterMediaController } from './recruiter-media.controller';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [AuthModule, MediaCleanupModule, forwardRef(() => InterviewModule)],
  controllers: [UploadController, RecruiterMediaController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
