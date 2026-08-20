import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';

import { AppConfigService } from '../app-config/app-config.service';
import { apiBadRequest, apiConflict } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import {
  getAnswerAttemptLimitBlockReason,
  getAnswerVersionNotReservedBlockReason,
  getAnswerVersionOverwriteBlockReason,
  getSavedAnswerVersions,
} from '../interview/answer-attempt-rules';
import { InterviewService } from '../interview/interview.service';
import {
  ConfirmUploadResponseDto,
  MultipartUploadAbortResponseDto,
  MultipartUploadCompleteResponseDto,
  MultipartUploadPartResponseDto,
  MultipartUploadSessionResponseDto,
  PresignedUrlResponseDto,
} from './dto/upload.responses.dto';
import { MediaCleanupService } from './media-cleanup.service';
import { assertMediaFileSizeBytesWithinLimit } from './media-file-size';
import type { S3StorageConfig } from './s3-storage.factory';
import { S3_STORAGE } from './s3-storage.module';
import {
  buildInterviewMediaKey,
  InterviewMediaType,
  matchesInterviewMediaKey,
  resolveVersionMediaKeyForArtifact,
} from './upload-key';

export interface PresignedDownloadUrlResponse {
  downloadUrl: string;
  mediaKey: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(
    @Inject(forwardRef(() => InterviewService))
    private readonly interviewService: InterviewService,
    private readonly mediaCleanupService: MediaCleanupService,
    private readonly appConfig: AppConfigService,
    @Inject(S3_STORAGE) storage: S3StorageConfig,
  ) {
    this.bucket = storage.bucket;
    this.prefix = storage.prefix;
    this.s3Client = storage.s3Client;
  }

  async generatePresignedUrl(
    interviewId: string,
    questionIndex: number,
    contentType: string,
    mediaType: 'camera' | 'screen' = 'camera',
    versionNumber?: number,
    options?: { requireReservedAttempt?: boolean; fileSizeBytes?: number },
  ): Promise<PresignedUrlResponseDto> {
    this.assertSupportedContentType(contentType);
    await this.assertFileSizeBytesWithinLimit(options?.fileSizeBytes);

    const normalizedMediaType = this.normalizeMediaType(mediaType);
    const mediaKey = this.buildMediaKey(
      interviewId,
      questionIndex,
      normalizedMediaType,
    );

    await this.assertCurrentQuestionUploadAllowed(
      interviewId,
      questionIndex,
      versionNumber,
      {
        requireReservedAttempt: options?.requireReservedAttempt,
        nextMediaKey: mediaKey,
      },
    );

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: mediaKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return { uploadUrl, mediaKey };
  }

  async startMultipartUpload(
    interviewId: string,
    questionIndex: number,
    contentType: string,
    mediaType: 'camera' | 'screen' = 'camera',
    versionNumber?: number,
    options?: { fileSizeBytes?: number },
  ): Promise<MultipartUploadSessionResponseDto> {
    this.assertSupportedContentType(contentType);
    await this.assertFileSizeBytesWithinLimit(options?.fileSizeBytes);

    const normalizedMediaType = this.normalizeMediaType(mediaType);
    const mediaKey = this.buildMediaKey(
      interviewId,
      questionIndex,
      normalizedMediaType,
    );

    await this.assertCurrentQuestionUploadAllowed(
      interviewId,
      questionIndex,
      versionNumber,
      { nextMediaKey: mediaKey },
    );

    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: mediaKey,
      ContentType: contentType,
    });

    const response = await this.s3Client.send(command);
    if (!response.UploadId) {
      throw apiBadRequest(
        ApiErrorCode.UPLOAD_FAILED,
        'Failed to initialize multipart upload',
        { interviewId, questionIndex },
      );
    }

    return {
      mediaKey,
      uploadId: response.UploadId,
    };
  }

  async presignMultipartPart(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
    uploadId: string,
    partNumber: number,
    versionNumber?: number,
  ): Promise<MultipartUploadPartResponseDto> {
    await this.assertCurrentQuestionUploadAllowed(
      interviewId,
      questionIndex,
      versionNumber,
      { nextMediaKey: mediaKey },
    );
    this.assertValidMediaKey(interviewId, questionIndex, mediaKey);

    if (!uploadId.trim()) {
      throw new BadRequestException('uploadId is required');
    }
    if (!Number.isInteger(partNumber) || partNumber < 1) {
      throw new BadRequestException('partNumber must be a positive integer');
    }

    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: mediaKey,
      UploadId: uploadId.trim(),
      PartNumber: partNumber,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return {
      mediaKey,
      uploadId: uploadId.trim(),
      partNumber,
      uploadUrl,
    };
  }

  async completeMultipartUpload(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
    uploadId: string,
    versionNumber?: number,
  ): Promise<MultipartUploadCompleteResponseDto> {
    await this.assertCurrentQuestionUploadAllowed(
      interviewId,
      questionIndex,
      versionNumber,
      { nextMediaKey: mediaKey },
    );
    this.assertValidMediaKey(interviewId, questionIndex, mediaKey);

    const normalizedUploadId = uploadId.trim();
    if (!normalizedUploadId) {
      throw new BadRequestException('uploadId is required');
    }

    const listPartsResponse = await this.s3Client.send(
      new ListPartsCommand({
        Bucket: this.bucket,
        Key: mediaKey,
        UploadId: normalizedUploadId,
      }),
    );

    const rawParts = listPartsResponse.Parts ?? [];
    const totalSizeBytes = rawParts.reduce(
      (acc, part) => acc + (part?.Size ?? 0),
      0,
    );
    if (totalSizeBytes > 0) {
      await this.assertFileSizeBytesWithinLimit(totalSizeBytes);
    }

    const parts = rawParts
      .filter(
        (part) => Boolean(part?.ETag) && typeof part?.PartNumber === 'number',
      )
      .map((part) => ({
        ETag: part!.ETag!,
        PartNumber: part!.PartNumber!,
      }));

    if (parts.length === 0) {
      throw new BadRequestException(
        'Cannot complete multipart upload without uploaded parts',
      );
    }

    await this.s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: mediaKey,
        UploadId: normalizedUploadId,
        MultipartUpload: {
          Parts: parts,
        },
      }),
    );

    return {
      mediaKey,
      uploadId: normalizedUploadId,
      completed: true,
    };
  }

  async abortMultipartUpload(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
    uploadId: string,
    versionNumber?: number,
  ): Promise<MultipartUploadAbortResponseDto> {
    await this.assertCurrentQuestionUploadAllowed(
      interviewId,
      questionIndex,
      versionNumber,
      { nextMediaKey: mediaKey, skipOverwriteCheck: true },
    );
    this.assertValidMediaKey(interviewId, questionIndex, mediaKey);

    const normalizedUploadId = uploadId.trim();
    if (!normalizedUploadId) {
      throw new BadRequestException('uploadId is required');
    }

    await this.s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: mediaKey,
        UploadId: normalizedUploadId,
      }),
    );

    return {
      mediaKey,
      uploadId: normalizedUploadId,
      aborted: true,
    };
  }

  async confirmUpload(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
    versionNumber?: number,
    options?: { requireReservedAttempt?: boolean; fileSizeBytes?: number },
  ): Promise<ConfirmUploadResponseDto> {
    await this.assertCurrentQuestionUploadAllowed(
      interviewId,
      questionIndex,
      versionNumber,
      {
        requireReservedAttempt: options?.requireReservedAttempt,
        nextMediaKey: mediaKey,
      },
    );
    this.assertValidMediaKey(interviewId, questionIndex, mediaKey);

    let actualSizeBytes = options?.fileSizeBytes;
    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: mediaKey,
        }),
      );
      if (typeof head.ContentLength === 'number' && head.ContentLength > 0) {
        actualSizeBytes = head.ContentLength;
      }
    } catch (error) {
      if (process.env.S3_ENDPOINT) {
        // Mock S3 (MinIO/LocalStack) — HeadObject may not work correctly, fall back to client size
        this.logger.warn(
          `HeadObject failed for ${mediaKey} in mock S3 env, falling back to client-provided size (${options?.fileSizeBytes ?? 'unknown'} bytes)`,
        );
      } else {
        this.logger.error(
          `HeadObject failed for ${mediaKey}, rejecting upload confirmation to prevent size limit bypass`,
          error instanceof Error ? error.stack : undefined,
        );
        throw apiBadRequest(
          ApiErrorCode.UPLOAD_FAILED,
          'Unable to verify uploaded file size. Please try again.',
          { mediaKey },
        );
      }
    }
    await this.assertFileSizeBytesWithinLimit(actualSizeBytes);

    return { mediaKey, confirmed: true };
  }

  async generateDownloadUrl(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
  ): Promise<PresignedDownloadUrlResponse> {
    this.assertValidMediaKey(interviewId, questionIndex, mediaKey);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: mediaKey,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return { downloadUrl, mediaKey };
  }

  async deleteInterviewMedia(interviewId: string): Promise<void> {
    return this.mediaCleanupService.deleteInterviewMedia(interviewId);
  }

  private async assertCurrentQuestionUploadAllowed(
    interviewId: string,
    questionIndex: number,
    versionNumber?: number,
    options?: {
      requireReservedAttempt?: boolean;
      nextMediaKey?: string;
      skipOverwriteCheck?: boolean;
    },
  ): Promise<void> {
    const interview = await this.interviewService.findOne(interviewId);
    const currentQuestionIndex = interview.answers.filter(
      (answer) => answer.status === 'submitted',
    ).length;
    if (questionIndex !== currentQuestionIndex) {
      throw apiBadRequest(
        ApiErrorCode.UPLOAD_NOT_ALLOWED,
        'Uploads are only allowed for the current question',
        { interviewId, questionIndex, currentQuestionIndex },
      );
    }
    if (questionIndex >= interview.questions.length) {
      throw new BadRequestException('Question index is out of range');
    }

    const answer = interview.answers.find(
      (item) => item.questionIndex === questionIndex,
    );
    const savedVersions = getSavedAnswerVersions(answer);
    const requireReservedAttempt = options?.requireReservedAttempt ?? true;

    if (requireReservedAttempt) {
      const notReservedReason = getAnswerVersionNotReservedBlockReason(
        savedVersions,
        versionNumber,
      );
      if (notReservedReason) {
        throw apiBadRequest(
          ApiErrorCode.ANSWER_VERSION_NOT_RESERVED,
          notReservedReason,
          { interviewId, questionIndex, versionNumber },
        );
      }

      if (!options?.skipOverwriteCheck) {
        const existingVersion =
          answer?.versions?.find(
            (version) => version.versionNumber === versionNumber,
          ) ??
          (answer && answer.selectedVersionNumber === versionNumber
            ? {
                mediaKey: answer.mediaKey,
                screenMediaKey: answer.screenMediaKey,
              }
            : undefined);

        const existingArtifactMediaKey = options?.nextMediaKey
          ? resolveVersionMediaKeyForArtifact({
              interviewId,
              questionIndex,
              mediaKey: options.nextMediaKey,
              version: existingVersion,
            })
          : existingVersion?.mediaKey;

        const overwriteReason = getAnswerVersionOverwriteBlockReason(
          existingArtifactMediaKey,
          options?.nextMediaKey,
        );
        if (overwriteReason) {
          throw apiConflict(
            ApiErrorCode.ANSWER_VERSION_OVERWRITE_FORBIDDEN,
            overwriteReason,
            { interviewId, questionIndex, versionNumber },
          );
        }
      }

      const maxAttempts = await this.appConfig.getNumber(
        'MAX_ANSWER_ATTEMPTS_PER_QUESTION',
        3,
      );
      const attemptLimitReason = getAnswerAttemptLimitBlockReason(
        savedVersions,
        versionNumber,
        maxAttempts,
      );
      if (attemptLimitReason) {
        throw apiBadRequest(
          ApiErrorCode.ANSWER_ATTEMPT_LIMIT_REACHED,
          attemptLimitReason,
          { interviewId, questionIndex, versionNumber },
        );
      }
    }
  }

  async assertFileSizeBytesWithinLimit(fileSizeBytes?: number): Promise<void> {
    await assertMediaFileSizeBytesWithinLimit(this.appConfig, fileSizeBytes);
  }

  private buildMediaKey(
    interviewId: string,
    questionIndex: number,
    mediaType: InterviewMediaType,
  ): string {
    return buildInterviewMediaKey({
      prefix: this.prefix,
      interviewId,
      questionIndex,
      mediaType,
    });
  }

  private normalizeMediaType(
    mediaType: 'camera' | 'screen' = 'camera',
  ): InterviewMediaType {
    return mediaType === 'screen' ? 'screen' : 'camera';
  }

  private assertSupportedContentType(contentType: string): void {
    if (contentType !== 'video/webm') {
      throw new BadRequestException('Unsupported content type');
    }
  }

  private assertValidMediaKey(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
  ): void {
    if (
      !matchesInterviewMediaKey({
        mediaKey,
        interviewId,
        questionIndex,
      })
    ) {
      throw new BadRequestException('Media key does not match the interview');
    }
  }
}
