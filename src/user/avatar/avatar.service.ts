import { Injectable, NotFoundException } from '@nestjs/common';

import { User } from '../interfaces/user.interface';
import { canReadUserProfile } from '../user-access-rules';
import { UserService } from '../user.service';
import { AvatarStorageService } from './avatar-storage.service';
import {
  AvatarPresignResponseDto,
  AvatarUpdateResponseDto,
} from './dto/avatar.dto';

@Injectable()
export class AvatarService {
  constructor(
    private readonly storageService: AvatarStorageService,
    private readonly userService: UserService,
  ) {}

  async presignUpload(
    userId: string,
    contentType: string,
    fileSizeBytes: number,
  ): Promise<AvatarPresignResponseDto> {
    return this.storageService.presignUpload(
      userId,
      contentType,
      fileSizeBytes,
    );
  }

  async confirmUpload(
    userId: string,
    avatarKey: string,
  ): Promise<AvatarUpdateResponseDto> {
    await this.storageService.validateUploadedObject(avatarKey, userId);

    const { previousAvatarKey, user } = await this.userService.setAvatarUpload(
      userId,
      avatarKey,
    );

    if (previousAvatarKey && previousAvatarKey !== avatarKey) {
      await this.storageService.deleteObjectQuietly(previousAvatarKey);
    }

    return {
      pictureUrl: user.pictureUrl ?? null,
      avatarSource: user.avatarSource,
    };
  }

  async deleteAvatar(userId: string): Promise<AvatarUpdateResponseDto> {
    const { previousAvatarKey, user } =
      await this.userService.clearAvatar(userId);

    if (previousAvatarKey) {
      await this.storageService.deleteObjectQuietly(previousAvatarKey);
    }

    return { pictureUrl: null, avatarSource: user.avatarSource };
  }

  async restoreGoogleAvatar(userId: string): Promise<AvatarUpdateResponseDto> {
    const { previousAvatarKey, user } =
      await this.userService.restoreGoogleAvatar(userId);

    if (previousAvatarKey) {
      await this.storageService.deleteObjectQuietly(previousAvatarKey);
    }

    return {
      pictureUrl: user.pictureUrl ?? null,
      avatarSource: user.avatarSource,
    };
  }

  async getRedirectUrl(
    actor: Omit<User, 'passwordHash'>,
    targetUserId: string,
  ): Promise<string> {
    const target = await this.userService.findById(targetUserId);
    if (
      !target ||
      !canReadUserProfile(
        { id: target.id, role: target.role },
        { id: actor.id, role: actor.role },
      )
    ) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    if (target.avatarSource !== 'upload' || !target.avatarKey) {
      throw new NotFoundException(
        `User ${targetUserId} has no uploaded avatar`,
      );
    }

    return this.storageService.getSignedDownloadUrl(target.avatarKey);
  }

  async deleteObjectQuietly(key: string): Promise<void> {
    return this.storageService.deleteObjectQuietly(key);
  }
}
