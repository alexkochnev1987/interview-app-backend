import { ServiceUnavailableException } from '@nestjs/common';
import { MediaCleanupService } from './media-cleanup.service';
import { AppConfigService } from '../app-config/app-config.service';

describe('MediaCleanupService', () => {
  it('retries failed S3 deletes and throws when cleanup is incomplete', async () => {
    const service = new MediaCleanupService({ getBoolean: vi.fn().mockResolvedValue(true) } as unknown as AppConfigService);
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: 'uploads/interviews/i1/answers/q0-camera-1.webm' }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({
        Errors: [{ Key: 'uploads/interviews/i1/answers/q0-camera-1.webm', Code: 'AccessDenied' }],
      })
      .mockResolvedValueOnce({
        Errors: [{ Key: 'uploads/interviews/i1/answers/q0-camera-1.webm', Code: 'AccessDenied' }],
      });

    (service as unknown as { s3Client: { send: ReturnType<typeof vi.fn> } }).s3Client = { send };

    await expect(service.deleteInterviewMedia('i1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(send).toHaveBeenCalledTimes(3);
  });
});
