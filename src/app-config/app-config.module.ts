import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { RecruiterAssistantConfigService } from './recruiter-assistant-config.service';
import {
  AppConfigController,
  PublicConfigController,
} from './app-config.controller';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [PublicConfigController, AppConfigController],
  providers: [AppConfigService, RecruiterAssistantConfigService],
  exports: [AppConfigService, RecruiterAssistantConfigService],
})
export class AppConfigModule {}
