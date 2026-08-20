import { Test } from '@nestjs/testing';

import type { S3StorageConfig } from './s3-storage.factory';
import {
  S3_STORAGE,
  S3StorageHolder,
  S3StorageModule,
} from './s3-storage.module';

describe('S3StorageModule', () => {
  it('provides a singleton S3_STORAGE instance and registers S3StorageHolder', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [S3StorageModule],
    }).compile();

    const storage = moduleRef.get<S3StorageConfig>(S3_STORAGE);
    const holder = moduleRef.get<S3StorageHolder>(S3StorageHolder);

    expect(storage).toBeDefined();
    expect(storage.bucket).toBeDefined();
    expect(storage.s3Client).toBeDefined();
    expect(holder.storage).toBe(storage);

    const destroySpy = vi.spyOn(storage.s3Client, 'destroy');
    holder.onApplicationShutdown();
    expect(destroySpy).toHaveBeenCalled();
  });
});
