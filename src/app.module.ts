import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiModule } from './ai/ai.module';
import { RecruiterAssistantModule } from './ai/recruiter-assistant/recruiter-assistant.module';
import { AppConfigModule } from './app-config/app-config.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FeedbackModule } from './feedback/feedback.module';
import { HealthModule } from './health/health.module';
import { InterviewModule } from './interview/interview.module';
import { LocaleModule } from './locale/locale.module';
import { PortalModule } from './portal/portal.module';
import { QuestionModule } from './question/question.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { TakeModule } from './take/take.module';
import { TemplateModule } from './template/template.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';

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
    PortalModule,
  ],
})
export class AppModule {}
