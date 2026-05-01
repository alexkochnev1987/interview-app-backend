import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InterviewService } from '../interview/interview.service';
import {
  buildInterviewMediaKey,
  InterviewMediaType,
  matchesInterviewMediaKey,
} from './upload-key';

export interface PresignedUrlResponse {
  uploadUrl: string;
  mediaKey: string;
}

export interface ConfirmUploadResponse {
  mediaKey: string;
  confirmed: boolean;
}

export interface MultipartUploadSessionResponse {
  mediaKey: string;
  uploadId: string;
}

export interface MultipartUploadPartResponse {
  mediaKey: string;
  uploadId: string;
  partNumber: number;
  uploadUrl: string;
}

export interface MultipartUploadCompleteResponse {
  mediaKey: string;
  uploadId: string;
  completed: boolean;
}

export interface MultipartUploadAbortResponse {
  mediaKey: string;
  uploadId: string;
  aborted: boolean;
}

export interface PresignedDownloadUrlResponse {
  downloadUrl: string;
  mediaKey: string;
}

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(private readonly interviewService: InterviewService) {
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

  async generatePresignedUrl(
    interviewId: string,
    questionIndex: number,
    contentType: string,
    mediaType: 'camera' | 'screen' = 'camera',
  ): Promise<PresignedUrlResponse> {
    this.assertSupportedContentType(contentType);
    await this.assertCurrentQuestionUploadAllowed(interviewId, questionIndex);

    const normalizedMediaType = this.normalizeMediaType(mediaType);
    const mediaKey = this.buildMediaKey(
      interviewId,
      questionIndex,
      normalizedMediaType,
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
  ): Promise<MultipartUploadSessionResponse> {
    this.assertSupportedContentType(contentType);
    await this.assertCurrentQuestionUploadAllowed(interviewId, questionIndex);

    const normalizedMediaType = this.normalizeMediaType(mediaType);
    const mediaKey = this.buildMediaKey(
      interviewId,
      questionIndex,
      normalizedMediaType,
    );

    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: mediaKey,
      ContentType: contentType,
    });

    const response = await this.s3Client.send(command);
    if (!response.UploadId) {
      throw new BadRequestException('Failed to initialize multipart upload');
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
  ): Promise<MultipartUploadPartResponse> {
    await this.assertCurrentQuestionUploadAllowed(interviewId, questionIndex);
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
  ): Promise<MultipartUploadCompleteResponse> {
    await this.assertCurrentQuestionUploadAllowed(interviewId, questionIndex);
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

    const parts = (listPartsResponse.Parts ?? [])
      .filter((part) => Boolean(part?.ETag) && typeof part?.PartNumber === 'number')
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
  ): Promise<MultipartUploadAbortResponse> {
    await this.assertCurrentQuestionUploadAllowed(interviewId, questionIndex);
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

  confirmUpload(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
  ): ConfirmUploadResponse {
    this.assertValidMediaKey(interviewId, questionIndex, mediaKey);

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

  private async assertCurrentQuestionUploadAllowed(
    interviewId: string,
    questionIndex: number,
  ): Promise<void> {
    const interview = await this.interviewService.findOne(interviewId);
    const currentQuestionIndex = interview.answers.filter(
      (answer) => answer.status === 'submitted',
    ).length;
    if (questionIndex !== currentQuestionIndex) {
      throw new BadRequestException(
        'Uploads are only allowed for the current question',
      );
    }
    if (questionIndex >= interview.questions.length) {
      throw new BadRequestException('Question index is out of range');
    }
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
