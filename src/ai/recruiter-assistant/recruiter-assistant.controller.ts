import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response.dto';
import { CurrentLocale } from '../../locale/decorators/current-locale.decorator';
import { Locale } from '../../locale/locale.constants';
import { User } from '../../user/interfaces/user.interface';
import {
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantChatDto,
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import { RecruiterAssistantService } from './recruiter-assistant.service';
import { StaffAiThrottlerGuard } from '../guards/staff-ai-throttler.guard';

type ActingUser = Omit<User, 'passwordHash'>;

@ApiTags('ai')
@ApiCookieAuth('sessionAuth')
@ApiExtraModels(
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantAssignHrPendingActionDto,
)
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruiterAssistantController {
  constructor(
    private readonly recruiterAssistantService: RecruiterAssistantService,
  ) {}

  @Post('chat')
  @UseGuards(StaffAiThrottlerGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: minutes(5),
    },
  })
  @ApiOperation({
    summary: 'Global AI chat',
    description:
      'Role-aware assistant for interview queries and confirmed actions. All authenticated roles may call this route; each tool enforces the same permissions as the REST API before reading data or mutating.',
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
