import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PresignRequestDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty({ enum: ['video/webm'] })
  @IsIn(['video/webm'])
  contentType!: string;

  @ApiPropertyOptional({ enum: ['camera', 'screen'] })
  @IsOptional()
  @IsIn(['camera', 'screen'])
  mediaType?: 'camera' | 'screen';
}

export class ConfirmUploadDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaKey!: string;
}

export class StartMultipartUploadDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty({ enum: ['video/webm'] })
  @IsIn(['video/webm'])
  contentType!: string;

  @ApiPropertyOptional({ enum: ['camera', 'screen'] })
  @IsOptional()
  @IsIn(['camera', 'screen'])
  mediaType?: 'camera' | 'screen';
}

export class PresignMultipartPartDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  uploadId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partNumber!: number;
}

export class CompleteMultipartUploadDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  uploadId!: string;
}

export class AbortMultipartUploadDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaKey!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  uploadId!: string;
}

export class PresignedUrlResponseDto {
  @ApiProperty()
  uploadUrl: string;

  @ApiProperty()
  mediaKey: string;
}

export class ConfirmUploadResponseDto {
  @ApiProperty()
  mediaKey: string;

  @ApiProperty({ example: true })
  confirmed: boolean;
}

export class MultipartUploadSessionResponseDto {
  @ApiProperty()
  mediaKey: string;

  @ApiProperty()
  uploadId: string;
}

export class MultipartUploadPartResponseDto {
  @ApiProperty()
  mediaKey: string;

  @ApiProperty()
  uploadId: string;

  @ApiProperty()
  partNumber: number;

  @ApiProperty()
  uploadUrl: string;
}

export class MultipartUploadCompleteResponseDto {
  @ApiProperty()
  mediaKey: string;

  @ApiProperty()
  uploadId: string;

  @ApiProperty({ example: true })
  completed: boolean;
}

export class MultipartUploadAbortResponseDto {
  @ApiProperty()
  mediaKey: string;

  @ApiProperty()
  uploadId: string;

  @ApiProperty({ example: true })
  aborted: boolean;
}

export class InterviewAnswerMediaResponseDto {
  @ApiProperty()
  questionIndex: number;

  @ApiPropertyOptional()
  cameraUrl?: string;

  @ApiPropertyOptional()
  screenUrl?: string;
}

export class RecruiterPresignUploadBodyDto {
  @ApiProperty({ enum: ['video/webm'] })
  @IsIn(['video/webm'])
  contentType!: 'video/webm';

  @ApiPropertyOptional({ enum: ['camera', 'screen'] })
  @IsOptional()
  @IsIn(['camera', 'screen'])
  mediaType?: 'camera' | 'screen';
}

export class RecruiterConfirmUploadBodyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaKey!: string;
}
