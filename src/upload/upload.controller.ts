import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import { UploadService } from './upload.service';
import {
  AbortMultipartUploadDto,
  CompleteMultipartUploadDto,
  ConfirmUploadDto,
  ConfirmUploadResponseDto,
  MultipartUploadAbortResponseDto,
  MultipartUploadCompleteResponseDto,
  MultipartUploadPartResponseDto,
  MultipartUploadSessionResponseDto,
  PresignMultipartPartDto,
  PresignRequestDto,
  PresignedUrlResponseDto,
  StartMultipartUploadDto,
} from './dto/upload.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

interface CandidateRequest {
  candidatePayload: { interviewId: string };
}

@ApiTags('upload')
@ApiCookieAuth('candidateSessionAuth')
@Controller('upload')
@UseGuards(CandidateSessionGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Generate one-shot upload URL' })
  @ApiBody({ type: PresignRequestDto })
  @ApiOkResponse({ type: PresignedUrlResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async presign(
    @Body() dto: PresignRequestDto,
    @Req() req: CandidateRequest,
  ): Promise<PresignedUrlResponseDto> {
    return this.uploadService.generatePresignedUrl(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.contentType,
      dto.mediaType,
    );
  }

  @Post('complete')
  @ApiOperation({ summary: 'Confirm one-shot upload' })
  @ApiBody({ type: ConfirmUploadDto })
  @ApiOkResponse({ type: ConfirmUploadResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  complete(
    @Body() dto: ConfirmUploadDto,
    @Req() req: CandidateRequest,
  ): ConfirmUploadResponseDto {
    return this.uploadService.confirmUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
    );
  }

  @Post('multipart/start')
  @ApiOperation({ summary: 'Start multipart upload session' })
  @ApiBody({ type: StartMultipartUploadDto })
  @ApiOkResponse({ type: MultipartUploadSessionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async startMultipartUpload(
    @Body() dto: StartMultipartUploadDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadSessionResponseDto> {
    return this.uploadService.startMultipartUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.contentType,
      dto.mediaType,
    );
  }

  @Post('multipart/part')
  @ApiOperation({ summary: 'Presign multipart upload part' })
  @ApiBody({ type: PresignMultipartPartDto })
  @ApiOkResponse({ type: MultipartUploadPartResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async presignMultipartPart(
    @Body() dto: PresignMultipartPartDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadPartResponseDto> {
    return this.uploadService.presignMultipartPart(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
      dto.uploadId,
      dto.partNumber,
    );
  }

  @Post('multipart/complete')
  @ApiOperation({ summary: 'Complete multipart upload session' })
  @ApiBody({ type: CompleteMultipartUploadDto })
  @ApiOkResponse({ type: MultipartUploadCompleteResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async completeMultipartUpload(
    @Body() dto: CompleteMultipartUploadDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadCompleteResponseDto> {
    return this.uploadService.completeMultipartUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
      dto.uploadId,
    );
  }

  @Post('multipart/abort')
  @ApiOperation({ summary: 'Abort multipart upload session' })
  @ApiBody({ type: AbortMultipartUploadDto })
  @ApiOkResponse({ type: MultipartUploadAbortResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async abortMultipartUpload(
    @Body() dto: AbortMultipartUploadDto,
    @Req() req: CandidateRequest,
  ): Promise<MultipartUploadAbortResponseDto> {
    return this.uploadService.abortMultipartUpload(
      req.candidatePayload.interviewId,
      dto.questionIndex,
      dto.mediaKey,
      dto.uploadId,
    );
  }
}
