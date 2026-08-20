import { S3Client } from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';

import { AppConfigService } from '../app-config/app-config.service';
import { MediaCleanupService } from './media-cleanup.service';
import type { S3StorageConfig } from './s3-storage.factory';

describe('MediaCleanupService', () => {
  it('retries failed S3 deletes and throws when cleanup is incomplete', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: 'uploads/interviews/i1/answers/q0-camera-1.webm' }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({
        Errors: [
          {
            Key: 'uploads/interviews/i1/answers/q0-camera-1.webm',
            Code: 'AccessDenied',
          },
        ],
      })
      .mockResolvedValueOnce({
        Errors: [
          {
            Key: 'uploads/interviews/i1/answers/q0-camera-1.webm',
            Code: 'AccessDenied',
          },
        ],
      });

    const storage: S3StorageConfig = {
      bucket: 'test-bucket',
      prefix: 'uploads',
      s3Client: { send } as unknown as S3Client,
    };

    const service = new MediaCleanupService(
      {
        getBoolean: vi.fn().mockResolvedValue(true),
      } as unknown as AppConfigService,
      storage,
    );

    await expect(service.deleteInterviewMedia('i1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(send).toHaveBeenCalledTimes(3);
  });
});
