import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response.dto';
import { User } from '../interfaces/user.interface';
import { AvatarService } from './avatar.service';
import {
  AvatarCompleteUploadDto,
  AvatarPresignRequestDto,
  AvatarPresignResponseDto,
  AvatarUpdateResponseDto,
} from './dto/avatar.dto';

@ApiTags('users')
@ApiCookieAuth('sessionAuth')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  // NOTE: the me/avatar/* routes must stay declared before :id/avatar below —
  // Nest/Express match routes in declaration order, and a future GET
  // /users/me/avatar would otherwise be silently swallowed by :id/avatar.

  @Post('me/avatar/presign')
  @ApiOperation({ summary: 'Get a presigned URL to upload a new avatar' })
  @ApiOkResponse({ type: AvatarPresignResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  presign(
    @CurrentUser() actor: Omit<User, 'passwordHash'>,
    @Body() dto: AvatarPresignRequestDto,
  ): Promise<AvatarPresignResponseDto> {
    return this.avatarService.presignUpload(
      actor.id,
      dto.contentType,
      dto.fileSizeBytes,
    );
  }

  @Post('me/avatar/complete')
  @ApiOperation({ summary: 'Confirm an uploaded avatar and activate it' })
  @ApiOkResponse({ type: AvatarUpdateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  complete(
    @CurrentUser() actor: Omit<User, 'passwordHash'>,
    @Body() dto: AvatarCompleteUploadDto,
  ): Promise<AvatarUpdateResponseDto> {
    return this.avatarService.confirmUpload(actor.id, dto.avatarKey);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Remove the current avatar, reverting to initials' })
  @ApiOkResponse({ type: AvatarUpdateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  remove(
    @CurrentUser() actor: Omit<User, 'passwordHash'>,
  ): Promise<AvatarUpdateResponseDto> {
    return this.avatarService.deleteAvatar(actor.id);
  }

  @Post('me/avatar/restore-google')
  @ApiOperation({
    summary: 'Restore the last-known Google photo as the active avatar',
  })
  @ApiOkResponse({ type: AvatarUpdateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  restoreGoogle(
    @CurrentUser() actor: Omit<User, 'passwordHash'>,
  ): Promise<AvatarUpdateResponseDto> {
    return this.avatarService.restoreGoogleAvatar(actor.id);
  }

  @Get(':id/avatar')
  @RequirePermissions('users:read_profile')
  @ApiOperation({ summary: 'Redirect to a presigned URL for a user\'s avatar' })
  @ApiParam({ name: 'id' })
  @ApiFoundResponse({ description: 'Redirects to a short-lived S3 URL' })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async proxy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Omit<User, 'passwordHash'>,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.avatarService.getRedirectUrl(actor, id);
    res.set('Cache-Control', 'private, max-age=300');
    res.redirect(302, redirectUrl);
  }
}
