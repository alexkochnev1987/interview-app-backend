import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
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

interface CandidateRequest {
  candidatePayload: { interviewId: string };
}

@Controller('upload')
@UseGuards(CandidateSessionGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
)
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
}
