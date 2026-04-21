import { BadRequestException, Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InterviewService } from '../interview/interview.service';
import {
  buildInterviewMediaKey,
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
    if (contentType !== 'video/webm') {
      throw new BadRequestException('Unsupported content type');
    }

    const normalizedMediaType = mediaType === 'screen' ? 'screen' : 'camera';
    const mediaKey = buildInterviewMediaKey({
      prefix: this.prefix,
      interviewId,
      questionIndex,
      mediaType: normalizedMediaType,
    });

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

  confirmUpload(
    interviewId: string,
    questionIndex: number,
    mediaKey: string,
  ): ConfirmUploadResponse {
    if (
      !matchesInterviewMediaKey({
        mediaKey,
        interviewId,
        questionIndex,
      })
    ) {
      throw new BadRequestException('Media key does not match the interview');
    }

    return { mediaKey, confirmed: true };
  }
}
