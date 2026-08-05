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
import { ApiErrorResponseDto } from '../../common/dto/api-error.response.dto';
import { CurrentLocale } from '../../locale/decorators/current-locale.decorator';
import { Locale } from '../../locale/locale.constants';
import { User } from '../../user/interfaces/user.interface';
import {
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantChatDto,
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantCreateSingleQuestionPendingActionDto,
  RecruiterAssistantResponseDto,
} from './dto/recruiter-assistant.dto';
import { RecruiterAssistantService } from './recruiter-assistant.service';
import { StaffAiThrottlerGuard } from '../guards/staff-ai-throttler.guard';
import { ApiErrorCode } from '../../common/errors/api-error.codes';
import { apiServiceUnavailable } from '../../common/errors/api-error';
import { isRecruiterAssistantEnabled } from './recruiter-assistant-env';

type ActingUser = Omit<User, 'passwordHash'>;

@ApiTags('ai')
@ApiCookieAuth('sessionAuth')
@ApiExtraModels(
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantAssignHrPendingActionDto,
  RecruiterAssistantCreateSingleQuestionPendingActionDto,
)
@Controller('ai')
@UseGuards(JwtAuthGuard)
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
    if (!isRecruiterAssistantEnabled()) {
      throw apiServiceUnavailable(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        'Recruiter assistant is disabled in this environment.',
      );
    }
    return this.recruiterAssistantService.chat(dto, user, locale);
  }

  @Post('chat/reset')
  @UseGuards(StaffAiThrottlerGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: minutes(5),
    },
  })
  @ApiOperation({ summary: 'Reset recruiter assistant conversation' })
  @ApiOkResponse({ type: RecruiterAssistantResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  resetChat(@CurrentUser() user: ActingUser): Promise<RecruiterAssistantResponseDto> {
    if (!isRecruiterAssistantEnabled()) {
      throw apiServiceUnavailable(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        'Recruiter assistant is disabled in this environment.',
      );
    }
    return this.recruiterAssistantService.newChat(user);
  }
}
