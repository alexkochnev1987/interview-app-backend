import { S3Client } from '@aws-sdk/client-s3';

export interface S3StorageConfig {
  s3Client: S3Client;
  bucket: string;
  prefix: string;
}

export function createS3Storage(): S3StorageConfig {
  const bucket = process.env.AWS_S3_BUCKET ?? 'interview-media';
  const prefix = process.env.S3_PREFIX ?? 'uploads';

  const s3Config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.AWS_REGION ?? 'us-east-1',
  };

  // MinIO / LocalStack support
  if (process.env.S3_ENDPOINT) {
    s3Config.endpoint = process.env.S3_ENDPOINT;
    s3Config.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    s3Config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'minioadmin',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'minioadmin',
    };
  }

  return {
    s3Client: new S3Client(s3Config),
    bucket,
    prefix,
  };
}
