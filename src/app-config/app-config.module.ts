import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import {
  AppConfigController,
  PublicConfigController,
} from './app-config.controller';
import { AppConfigService } from './app-config.service';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [PublicConfigController, AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
