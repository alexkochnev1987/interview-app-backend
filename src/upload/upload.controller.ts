import { Body, Controller, Post } from '@nestjs/common';
import {
  UploadService,
  PresignedUrlResponse,
  ConfirmUploadResponse,
} from './upload.service';

class PresignRequestDto {
  interviewId: string;
  questionIndex: number;
  contentType: string;
}

class ConfirmUploadDto {
  interviewId: string;
  questionIndex: number;
  mediaKey: string;
}

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  async presign(@Body() dto: PresignRequestDto): Promise<PresignedUrlResponse> {
    return this.uploadService.generatePresignedUrl(
      dto.interviewId,
      dto.questionIndex,
      dto.contentType,
    );
  }

  @Post('complete')
  complete(@Body() dto: ConfirmUploadDto): ConfirmUploadResponse {
    return this.uploadService.confirmUpload(
      dto.interviewId,
      dto.questionIndex,
      dto.mediaKey,
    );
  }
}
