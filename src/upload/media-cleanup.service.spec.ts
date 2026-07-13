import { ServiceUnavailableException } from '@nestjs/common';
import { MediaCleanupService } from './media-cleanup.service';

describe('MediaCleanupService', () => {
  it('retries failed S3 deletes and throws when cleanup is incomplete', async () => {
    const service = new MediaCleanupService();
    const send = jest
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

    (service as unknown as { s3Client: { send: jest.Mock } }).s3Client = { send };

    await expect(service.deleteInterviewMedia('i1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(send).toHaveBeenCalledTimes(3);
  });
});
