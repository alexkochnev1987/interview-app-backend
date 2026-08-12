import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { User } from '../user/interfaces/user.interface';
import { FeedbackLinkResponseDto } from './dto/feedback-link.response.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('interviews')
@ApiCookieAuth('sessionAuth')
@Controller('interviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeedbackLinkController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post(':id/feedback-link')
  @RequirePermissions('feedback:create_share_link')
  @ApiOperation({
    summary: 'Create a shareable feedback link for an interview',
  })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiOkResponse({ type: FeedbackLinkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async createLink(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    const { link, url } = await this.feedbackService.createLink(interviewId, {
      id: user.id,
      role: user.role,
      demo: user.demo,
    });
    return {
      url,
      expiresAt: link.expiresAt,
    };
  }

  @Delete(':id/feedback-link')
  @RequirePermissions('feedback:revoke_share_link')
  @ApiOperation({ summary: 'Revoke the active shareable feedback link' })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiOkResponse({ description: 'Link successfully revoked' })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async revokeLink(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.feedbackService.revokeActiveLink(interviewId, {
      id: user.id,
      role: user.role,
      demo: user.demo,
    });
  }
}
