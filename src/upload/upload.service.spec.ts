import { UploadService } from './upload.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('UploadService multipart attempt limits', () => {
  let service: UploadService;

  beforeEach(() => {
    mockGetSignedUrl.mockReset();
    mockGetSignedUrl.mockResolvedValue('https://example.test/upload');

    service = new UploadService(
      {
        findOne: jest.fn(),
      } as unknown as ConstructorParameters<typeof UploadService>[0],
      {
        deleteInterviewMedia: jest.fn(),
      } as unknown as ConstructorParameters<typeof UploadService>[1],
    );

    (service as unknown as { assertCurrentQuestionUploadAllowed: jest.Mock })
      .assertCurrentQuestionUploadAllowed = jest
      .fn()
      .mockResolvedValue(undefined);
    (service as unknown as { assertValidMediaKey: jest.Mock }).assertValidMediaKey =
      jest.fn();
  });

  it('passes versionNumber to multipart/part limit check', async () => {
    await service.presignMultipartPart(
      'interview-1',
      0,
      'dev/interviews/interview-1/answers/q0-camera-1.webm',
      'upload-id',
      1,
      3,
    );

    expect(
      (service as unknown as { assertCurrentQuestionUploadAllowed: jest.Mock })
        .assertCurrentQuestionUploadAllowed,
    ).toHaveBeenCalledWith('interview-1', 0, 3);
  });

  it('passes versionNumber to multipart/complete limit check', async () => {
    (service as unknown as { s3Client: { send: jest.Mock } }).s3Client = {
      send: jest
        .fn()
        .mockResolvedValueOnce({ Parts: [{ ETag: '"etag"', PartNumber: 1 }] })
        .mockResolvedValueOnce({}),
    };

    await service.completeMultipartUpload(
      'interview-1',
      0,
      'dev/interviews/interview-1/answers/q0-camera-1.webm',
      'upload-id',
      3,
    );

    expect(
      (service as unknown as { assertCurrentQuestionUploadAllowed: jest.Mock })
        .assertCurrentQuestionUploadAllowed,
    ).toHaveBeenCalledWith('interview-1', 0, 3);
  });

  it('passes versionNumber to multipart/abort limit check', async () => {
    (service as unknown as { s3Client: { send: jest.Mock } }).s3Client = {
      send: jest.fn().mockResolvedValue({}),
    };

    await service.abortMultipartUpload(
      'interview-1',
      0,
      'dev/interviews/interview-1/answers/q0-camera-1.webm',
      'upload-id',
      3,
    );

    expect(
      (service as unknown as { assertCurrentQuestionUploadAllowed: jest.Mock })
        .assertCurrentQuestionUploadAllowed,
    ).toHaveBeenCalledWith('interview-1', 0, 3);
  });
});
