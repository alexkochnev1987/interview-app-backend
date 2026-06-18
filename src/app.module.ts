import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { InterviewModule } from './interview/interview.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';
import { TakeModule } from './take/take.module';
import { AiModule } from './ai/ai.module';
import { DatabaseModule } from './database/database.module';
import { QuestionModule } from './question/question.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RateLimitModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    QuestionModule,
    InterviewModule,
    UploadModule,
    HealthModule,
    TakeModule,
    AiModule,
    FeedbackModule,
  ],
})
export class AppModule {}
