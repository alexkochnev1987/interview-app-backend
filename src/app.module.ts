import { Module } from '@nestjs/common';
import { InterviewModule } from './interview/interview.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [InterviewModule, UploadModule, HealthModule],
})
export class AppModule {}
