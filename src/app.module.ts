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
import { TemplateModule } from './template/template.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { FeedbackModule } from './feedback/feedback.module';
import { LocaleModule } from './locale/locale.module';
import { RecruiterAssistantModule } from './ai/recruiter-assistant/recruiter-assistant.module';
import { AppConfigModule } from './app-config/app-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    LocaleModule,
    RateLimitModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    QuestionModule,
    TemplateModule,
    InterviewModule,
    UploadModule,
    HealthModule,
    TakeModule,
    AiModule,
    RecruiterAssistantModule,
    FeedbackModule,
  ],
})
export class AppModule {}
