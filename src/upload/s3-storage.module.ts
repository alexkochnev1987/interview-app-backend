import {
  Global,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';

import { createS3Storage, S3StorageConfig } from './s3-storage.factory';

export const S3_STORAGE = Symbol('S3_STORAGE');

@Injectable()
export class S3StorageHolder implements OnApplicationShutdown {
  constructor(public readonly storage: S3StorageConfig) {}

  onApplicationShutdown(): void {
    this.storage.s3Client.destroy();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: S3_STORAGE,
      useFactory: (): S3StorageConfig => createS3Storage(),
    },
    {
      provide: S3StorageHolder,
      useFactory: (storage: S3StorageConfig): S3StorageHolder =>
        new S3StorageHolder(storage),
      inject: [S3_STORAGE],
    },
  ],
  exports: [S3_STORAGE, S3StorageHolder],
})
export class S3StorageModule {}
