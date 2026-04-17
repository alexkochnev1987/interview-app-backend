import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET ?? 'interview-media';
    this.prefix = process.env.S3_PREFIX ?? 'uploads';
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
    });
  }

  async generatePresignedUrl(
    interviewId: string,
    questionIndex: number,
    contentType: string,
  ): Promise<PresignedUrlResponse> {
    const mediaKey = `${this.prefix}/${interviewId}/${questionIndex}/${Date.now()}`;

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
    // In a real implementation this would update the interview record
    // via InterviewService. For MVP, just acknowledge the confirmation.
    void interviewId;
    void questionIndex;

    return { mediaKey, confirmed: true };
  }
}
