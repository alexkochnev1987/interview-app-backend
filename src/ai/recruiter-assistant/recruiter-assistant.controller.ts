import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response.dto';
import { CurrentLocale } from '../../locale/decorators/current-locale.decorator';
import { Locale } from '../../locale/locale.constants';
import { User } from '../../user/interfaces/user.interface';
import {
  RecruiterAssistantChatDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import { RecruiterAssistantService } from './recruiter-assistant.service';

type ActingUser = Omit<User, 'passwordHash'>;

@ApiTags('ai')
@ApiCookieAuth('sessionAuth')
@Controller('ai/recruiter-assistant')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruiterAssistantController {
  constructor(
    private readonly recruiterAssistantService: RecruiterAssistantService,
  ) {}

  @Post('chat')
  @RequirePermissions('questions:read')
  @ApiOperation({
    summary: 'Recruiter assistant chat',
    description:
      'Scoped assistant for interview and question-bank workflows. The route can read question-bank data with questions:read; write actions are confirmed by the user and checked against the current user permissions before execution.',
  })
  @ApiBody({ type: RecruiterAssistantChatDto })
  @ApiOkResponse({ type: RecruiterAssistantResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  chat(
    @Body() dto: RecruiterAssistantChatDto,
    @CurrentUser() user: ActingUser,
    @CurrentLocale() locale: Locale,
  ): Promise<RecruiterAssistantResponseDto> {
    return this.recruiterAssistantService.chat(dto, user, locale);
  }
}
