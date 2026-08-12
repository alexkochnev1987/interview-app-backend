import { Module } from '@nestjs/common';

import { AppConfigModule } from '../app-config/app-config.module';
import { MediaCleanupService } from './media-cleanup.service';

@Module({
  imports: [AppConfigModule],
  providers: [MediaCleanupService],
  exports: [MediaCleanupService],
})
export class MediaCleanupModule {}
