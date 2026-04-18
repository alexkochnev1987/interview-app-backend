import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { InterviewModule } from './interview/interview.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';
import { TakeModule } from './take/take.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    InterviewModule,
    UploadModule,
    HealthModule,
    TakeModule,
    AiModule,
  ],
})
export class AppModule {}
