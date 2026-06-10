import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentLocale } from '../locale/decorators/current-locale.decorator';
import { Locale } from '../locale/locale.constants';
import { Throttle, minutes } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { QuestionDraft } from '../question/interfaces/question.interface';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import { CandidateAiThrottlerGuard } from './guards/candidate-ai-throttler.guard';
import { StaffAiThrottlerGuard } from './guards/staff-ai-throttler.guard';
import {
  AiTextResponseDto,
  ChatDto,
  DraftQuestionDto,
  GreetDto,
} from './dto/ai.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { QuestionDraftResponseDto } from '../question/dto/question.responses.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @UseGuards(CandidateSessionGuard, CandidateAiThrottlerGuard)
  @ApiCookieAuth('candidateSessionAuth')
  @Throttle({
    default: {
      limit: 12,
      ttl: minutes(5),
    },
  })
  @ApiOperation({ summary: 'Candidate chat assistant' })
  @ApiBody({ type: ChatDto })
  @ApiOkResponse({ type: AiTextResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async chat(@Body() dto: ChatDto) {
    const response = await this.aiService.chat(
      dto.question,
      dto.position,
      dto.candidateName,
      dto.history,
      dto.message,
    );
    return { response };
  }

  @Post('greet')
  @UseGuards(CandidateSessionGuard, CandidateAiThrottlerGuard)
  @ApiCookieAuth('candidateSessionAuth')
  @Throttle({
    default: {
      limit: 5,
      ttl: minutes(1),
    },
  })
  @ApiOperation({ summary: 'Candidate greeting prompt' })
  @ApiBody({ type: GreetDto })
  @ApiOkResponse({ type: AiTextResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async greet(@Body() dto: GreetDto) {
    const response = await this.aiService.greet(
      dto.candidateName,
      dto.position,
      dto.totalQuestions,
    );
    return { response };
  }

  @Post('question-draft')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StaffAiThrottlerGuard)
  @ApiCookieAuth('sessionAuth')
  @RequirePermissions('questions:create')
  @Throttle({
    default: {
      limit: 20,
      ttl: minutes(5),
    },
  })
  @ApiOperation({
    summary: 'Generate draft question with AI',
    description:
      'Deprecated compatibility endpoint. Use POST /questions/ai/draft. ' +
      'Generates rubric fields in the requested locale from body `locale` or `X-Locale` (default `en`).',
    deprecated: true,
  })
  @ApiHeader({
    name: 'X-Locale',
    required: false,
    description: 'Used when body `locale` is omitted. Defaults to `en`.',
  })
  @ApiBody({
    type: DraftQuestionDto,
    examples: {
      polishFromSeed: {
        summary: 'Polish draft (body locale)',
        description:
          'Seed text can be any language; output rubric is generated in Polish.',
        value: {
          locale: 'pl',
          question: {
            questionText: 'Wyjaśnij działanie hooków w React.',
            category: 'react',
          },
        },
      },
      englishViaHeader: {
        summary: 'English draft (header only)',
        value: {
          question: {
            questionText: 'Explain how CSS flexbox distributes free space.',
          },
        },
      },
    },
  })
  @ApiOkResponse({ type: QuestionDraftResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  draftQuestion(
    @Body() dto: DraftQuestionDto,
    @CurrentLocale() headerLocale: Locale,
  ): Promise<QuestionDraft> {
    return this.aiService.draftQuestion(dto.question ?? {}, {
      bodyLocale: dto.locale,
      headerLocale,
    });
  }
}
