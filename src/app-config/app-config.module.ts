import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import {
  AppConfigController,
  PublicConfigController,
} from './app-config.controller';

@Global()
@Module({
  controllers: [PublicConfigController, AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
