import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApiErrorCode } from '../../common/errors/api-error.codes';
import { apiBadRequest } from '../../common/errors/api-error';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UserService } from '../user.service';
import { canReadUserProfile } from '../user-access-rules';
import { User } from '../interfaces/user.interface';
import {
  buildUserAvatarKey,
  extensionForAvatarContentType,
  MAX_AVATAR_UPLOAD_BYTES,
  matchesUserAvatarKey,
  SUPPORTED_AVATAR_CONTENT_TYPES,
} from './avatar-key';
import {
  AvatarPresignResponseDto,
  AvatarUpdateResponseDto,
} from './dto/avatar.dto';

@Injectable()
export class AvatarService {
  private static readonly logger = new Logger(AvatarService.name);

  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(private readonly userService: UserService) {
    this.bucket = process.env.AWS_S3_BUCKET ?? 'interview-media';
    this.prefix = process.env.S3_PREFIX ?? 'uploads';

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

    this.s3Client = new S3Client(s3Config);
  }

  async presignUpload(
    userId: string,
    contentType: string,
    fileSizeBytes: number,
  ): Promise<AvatarPresignResponseDto> {
    this.assertSupportedContentType(contentType);
    this.assertAllowedSize(fileSizeBytes);

    const ext = extensionForAvatarContentType(contentType)!;
    const avatarKey = buildUserAvatarKey({ prefix: this.prefix, userId, ext });

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: avatarKey,
      ContentType: contentType,
      ContentLength: fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return { uploadUrl, avatarKey };
  }

  async confirmUpload(
    userId: string,
    avatarKey: string,
  ): Promise<AvatarUpdateResponseDto> {
    this.assertValidAvatarKey(avatarKey, userId);

    // The client's declared fileSizeBytes at presign time isn't enforced by
    // S3 on the PUT itself, so re-check the object that actually landed.
    let head: HeadObjectCommandOutput;
    try {
      head = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: avatarKey }),
      );
    } catch (error) {
      if (this.isS3NotFoundError(error)) {
        throw apiBadRequest(
          ApiErrorCode.UPLOAD_FAILED,
          'No uploaded file found for this avatar key',
        );
      }
      throw error;
    }
    if ((head.ContentLength ?? 0) > MAX_AVATAR_UPLOAD_BYTES) {
      await this.deleteObjectQuietly(avatarKey);
      throw apiBadRequest(
        ApiErrorCode.AVATAR_TOO_LARGE,
        `Avatar file exceeds the ${MAX_AVATAR_UPLOAD_BYTES} byte limit`,
      );
    }
    if (
      !head.ContentType ||
      !SUPPORTED_AVATAR_CONTENT_TYPES.includes(head.ContentType)
    ) {
      await this.deleteObjectQuietly(avatarKey);
      throw apiBadRequest(
        ApiErrorCode.AVATAR_UNSUPPORTED_TYPE,
        `Unsupported avatar content type: ${head.ContentType ?? 'missing'}`,
      );
    }

    const { previousAvatarKey, user } = await this.userService.setAvatarUpload(
      userId,
      avatarKey,
    );

    if (previousAvatarKey && previousAvatarKey !== avatarKey) {
      await this.deleteObjectQuietly(previousAvatarKey);
    }

    return { pictureUrl: user.pictureUrl ?? null };
  }

  async deleteAvatar(userId: string): Promise<AvatarUpdateResponseDto> {
    const { previousAvatarKey } = await this.userService.clearAvatar(userId);

    if (previousAvatarKey) {
      await this.deleteObjectQuietly(previousAvatarKey);
    }

    return { pictureUrl: null };
  }

  async getRedirectUrl(
    actor: Omit<User, 'passwordHash'>,
    targetUserId: string,
  ): Promise<string> {
    const target = await this.userService.findById(targetUserId);
    if (
      !target ||
      !canReadUserProfile(
        { id: target.id, role: target.role },
        { id: actor.id, role: actor.role },
      )
    ) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    if (target.avatarSource !== 'upload' || !target.avatarKey) {
      // Google-sourced and unset avatars are served directly from
      // pictureUrl (see avatar-picture-url.ts) and never hit this proxy.
      throw new NotFoundException(`User ${targetUserId} has no uploaded avatar`);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: target.avatarKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  private isS3NotFoundError(error: unknown): boolean {
    if (!(error instanceof S3ServiceException)) {
      return false;
    }
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      return true;
    }
    return error.$metadata?.httpStatusCode === 404;
  }

  private async deleteObjectQuietly(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      AvatarService.logger.warn(
        `Failed to delete orphaned avatar object ${key}: ${String(error)}`,
      );
    }
  }

  private assertSupportedContentType(contentType: string): void {
    if (!SUPPORTED_AVATAR_CONTENT_TYPES.includes(contentType)) {
      throw apiBadRequest(
        ApiErrorCode.AVATAR_UNSUPPORTED_TYPE,
        `Unsupported avatar content type: ${contentType}`,
      );
    }
  }

  private assertAllowedSize(fileSizeBytes: number): void {
    if (fileSizeBytes > MAX_AVATAR_UPLOAD_BYTES) {
      throw apiBadRequest(
        ApiErrorCode.AVATAR_TOO_LARGE,
        `Avatar file exceeds the ${MAX_AVATAR_UPLOAD_BYTES} byte limit`,
      );
    }
  }

  private assertValidAvatarKey(avatarKey: string, userId: string): void {
    if (!matchesUserAvatarKey({ avatarKey, userId })) {
      throw apiBadRequest(
        ApiErrorCode.BAD_REQUEST,
        'Avatar key does not belong to the current user',
      );
    }
  }
}
