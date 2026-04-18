import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { InterviewModule } from './interview/interview.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';
import { TakeModule } from './take/take.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
