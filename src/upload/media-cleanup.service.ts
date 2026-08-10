import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiServiceUnavailable } from '../common/errors/api-error';
import { getInterviewMediaPrefix } from './upload-key';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(private readonly appConfig: AppConfigService) {
    this.bucket = process.env.AWS_S3_BUCKET ?? 'interview-media';
    this.prefix = process.env.S3_PREFIX ?? 'uploads';

    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region: process.env.AWS_REGION ?? 'us-east-1',
    };

    if (process.env.S3_ENDPOINT) {
      s3Config.endpoint = process.env.S3_ENDPOINT;
      s3Config.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'minioadmin',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'minioadmin',
      };
    }

    this.s3Client = new S3Client(s3Config);
  }

  async deleteInterviewMedia(interviewId: string): Promise<void> {
    const enabled = await this.appConfig.getBoolean('ENABLE_S3_MEDIA_CLEANUP', true);
    if (!enabled) {
      this.logger.log(
        `S3 media cleanup skipped for interview ${interviewId}: disabled via runtime config`,
      );
      return;
    }

    const prefix = getInterviewMediaPrefix(this.prefix, interviewId);

    let continuationToken: string | undefined;
    do {
      const listed = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (listed.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key));

      await this.deleteObjectKeys(keys, interviewId);

      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }

  private async deleteObjectKeys(
    keys: string[],
    interviewId: string,
  ): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    let pending = keys;
    for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
      const failed: string[] = [];
      for (let i = 0; i < pending.length; i += 1000) {
        const chunk = pending.slice(i, i + 1000);
        const response = await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: chunk.map((Key) => ({ Key })),
              Quiet: true,
            },
          }),
        );

        for (const error of response.Errors ?? []) {
          if (!error.Key) {
            continue;
          }
          failed.push(error.Key);
          this.logger.warn(
            `S3 delete failed for ${error.Key}: ${error.Code ?? 'unknown'} ${error.Message ?? ''}`.trim(),
          );
        }
      }
      pending = failed;
    }

    if (pending.length > 0) {
      throw apiServiceUnavailable(
        ApiErrorCode.UPLOAD_FAILED,
        'Failed to delete all interview media',
        { interviewId, failedKeys: pending },
      );
    }
  }
}
