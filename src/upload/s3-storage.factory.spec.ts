import { createS3Storage } from './s3-storage.factory';

describe('s3-storage.factory', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates default S3 storage config with standard environment variables', () => {
    delete process.env.AWS_S3_BUCKET;
    delete process.env.S3_PREFIX;
    delete process.env.S3_ENDPOINT;

    const storage = createS3Storage();
    expect(storage.bucket).toBe('interview-media');
    expect(storage.prefix).toBe('uploads');
    expect(storage.s3Client).toBeDefined();
  });

  it('supports custom S3 bucket, prefix, and MinIO endpoint', () => {
    process.env.AWS_S3_BUCKET = 'custom-bucket';
    process.env.S3_PREFIX = 'custom-prefix';
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_FORCE_PATH_STYLE = 'true';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    const storage = createS3Storage();
    expect(storage.bucket).toBe('custom-bucket');
    expect(storage.prefix).toBe('custom-prefix');
    expect(storage.s3Client).toBeDefined();
  });
});
