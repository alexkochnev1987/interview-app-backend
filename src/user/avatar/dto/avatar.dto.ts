import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { AVATAR_SOURCES, AvatarSource } from '../../interfaces/user.interface';
import {
  MAX_AVATAR_UPLOAD_BYTES,
  SUPPORTED_AVATAR_CONTENT_TYPES,
} from '../avatar-key';

export class AvatarPresignRequestDto {
  @ApiProperty({ enum: SUPPORTED_AVATAR_CONTENT_TYPES })
  @IsIn(SUPPORTED_AVATAR_CONTENT_TYPES)
  contentType!: string;

  @ApiProperty({ example: 204800, maximum: MAX_AVATAR_UPLOAD_BYTES })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AVATAR_UPLOAD_BYTES)
  fileSizeBytes!: number;
}

export class AvatarPresignResponseDto {
  @ApiProperty()
  uploadUrl: string;

  @ApiProperty()
  avatarKey: string;
}

export class AvatarCompleteUploadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  avatarKey!: string;
}

export class AvatarUpdateResponseDto {
  @ApiProperty({
    type: String,
    example: '/users/8d2a6457-7f4b-4cef-9f10-8cff885f7e15/avatar',
    nullable: true,
  })
  pictureUrl: string | null;

  @ApiProperty({ enum: AVATAR_SOURCES })
  avatarSource: AvatarSource;
}
