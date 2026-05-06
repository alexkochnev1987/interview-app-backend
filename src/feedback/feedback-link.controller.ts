import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { FeedbackService } from './feedback.service';

@Controller('interviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeedbackLinkController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post(':id/feedback-link')
  @RequirePermissions('feedback:create_share_link')
  async createLink(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    const { link, url } = await this.feedbackService.createLink(interviewId, {
      id: user.id,
      role: user.role,
    });
    return {
      url,
      expiresAt: link.expiresAt,
    };
  }

  @Delete(':id/feedback-link')
  @RequirePermissions('feedback:revoke_share_link')
  async revokeLink(
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    return this.feedbackService.revokeActiveLink(interviewId, {
      id: user.id,
      role: user.role,
    });
  }
}
