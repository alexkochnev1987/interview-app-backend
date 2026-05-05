import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import {
  UploadService,
  PresignedUrlResponse,
  ConfirmUploadResponse,
  MultipartUploadSessionResponse,
  MultipartUploadPartResponse,
  MultipartUploadCompleteResponse,
  MultipartUploadAbortResponse,
} from './upload.service';

class PresignRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsIn(['video/webm'])
  contentType!: string;

  @IsOptional()
  @IsIn(['camera', 'screen'])
  mediaType?: 'camera' | 'screen';
}

class ConfirmUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsString()
  @IsNotEmpty()
  mediaKey!: string;
}

class StartMultipartUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsIn(['video/webm'])
  contentType!: string;

  @IsOptional()
  @IsIn(['camera', 'screen'])
  mediaType?: 'camera' | 'screen';
}

class PresignMultipartPartDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @IsString()
  @IsNotEmpty()
  uploadId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  partNumber!: number;
}

class CompleteMultipartUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @IsString()
  @IsNotEmpty()
  uploadId!: string;
}

class AbortMultipartUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @IsString()
  @IsNotEmpty()
  uploadId!: string;
}

interface CandidateRequest {
  candidatePayload: { interviewId: string };
}

@Controller('upload')
@UseGuards(CandidateSessionGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  async presign(
    @Body() dto: PresignRequestDto,
    @Req() req: CandidateRequest,
  ): Promise<PresignedUrlResponse> {
    return this.uploadService.generatePresignedUrl(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.contentType,
      dto.mediaType,
    );
  }

  @Post('complete')
  complete(
    @Body() dto: ConfirmUploadDto,
    @Req() req: CandidateRequest,
  ): ConfirmUploadResponse {
    return this.uploadService.confirmUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
    );
  }

  @Post('multipart/start')
  async startMultipartUpload(
    @Body() dto: StartMultipartUploadDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadSessionResponse> {
    return this.uploadService.startMultipartUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.contentType,
      dto.mediaType,
    );
  }

  @Post('multipart/part')
  async presignMultipartPart(
    @Body() dto: PresignMultipartPartDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadPartResponse> {
    return this.uploadService.presignMultipartPart(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
      dto.uploadId,
      dto.partNumber,
    );
  }

  @Post('multipart/complete')
  async completeMultipartUpload(
    @Body() dto: CompleteMultipartUploadDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadCompleteResponse> {
    return this.uploadService.completeMultipartUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
      dto.uploadId,
    );
  }

  @Post('multipart/abort')
  async abortMultipartUpload(
    @Body() dto: AbortMultipartUploadDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadAbortResponse> {
    return this.uploadService.abortMultipartUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
      dto.uploadId,
    );
  }
}
