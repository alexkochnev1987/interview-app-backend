import { Module } from '@nestjs/common';
import { MediaCleanupService } from './media-cleanup.service';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [AppConfigModule],
  providers: [MediaCleanupService],
  exports: [MediaCleanupService],
})
export class MediaCleanupModule {}
