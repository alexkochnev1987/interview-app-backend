import { Module } from '@nestjs/common';
import { MediaCleanupService } from './media-cleanup.service';

@Module({
  providers: [MediaCleanupService],
  exports: [MediaCleanupService],
})
export class MediaCleanupModule {}
