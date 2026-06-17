import { Body, Controller, Header, Post, UseGuards } from '@nestjs/common';
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
import { QuestionDraftContent } from './question-draft-content';
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
import {
  QuestionDraftResponseDto,
  QuestionDraftContentResponseDto,
} from '../question/dto/question.responses.dto';

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
  @Header('Deprecation', 'true')
  @Header('Link', '</questions/ai/draft>; rel="successor-version"')
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
      'Supports two scenarios: `translate` (full primary content block from `question.primaryLocale` to body `locale`; ids preserved 1:1) and `generate` (primary locale content block only — questionText + rubric fields; seed metadata is context, not returned). ' +
      'When `mode` is omitted, locale mismatch with full primary content triggers translate mode automatically.',
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
      translateRuToPl: {
        summary: 'Translate full primary block ru → pl',
        description:
          'Requires complete primary rubric (follow-ups, concepts, red flags, sample answer).',
        value: {
          mode: 'translate',
          locale: 'pl',
          question: {
            primaryLocale: 'ru',
            questionText: 'Объясните замыкания в JavaScript.',
            followUpQuestions: [
              'Можете привести простой практический пример?',
              'Какую типичную ошибку вы бы избегали?',
            ],
            expectedConcepts: [
              {
                id: 'scope_chain',
                label: 'цепочка областей видимости',
                weight: 0.34,
                description: 'должна быть явно раскрыта',
              },
              {
                id: 'lexical_env',
                label: 'лексическое окружение',
                weight: 0.33,
                description: 'объяснить привязку',
              },
              {
                id: 'practical_use',
                label: 'практическое применение',
                weight: 0.33,
                description: 'привести реальный пример',
              },
            ],
            redFlags: [
              { id: 'confuses_scope', label: 'Путает область видимости', severity: 'medium' },
              { id: 'no_example', label: 'Нет примера', severity: 'high' },
            ],
            sampleGoodAnswer:
              'Сильный ответ объясняет замыкания простыми словами и приводит один пример.',
          },
        },
      },
      translateBeToEn: {
        summary: 'Translate full primary block be → en',
        value: {
          mode: 'translate',
          locale: 'en',
          question: {
            primaryLocale: 'be',
            questionText: 'Растлумачце, як працуе віртуальны DOM у React.',
            followUpQuestions: [
              'Can you walk through a simple practical example?',
              'What common pitfall would you avoid?',
            ],
            expectedConcepts: [
              {
                id: 'virtual_dom',
                label: 'віртуальны DOM',
                weight: 0.34,
                description: 'поясняе мадэль',
              },
              {
                id: 'reconciliation',
                label: 'рэкансіліяцыя',
                weight: 0.33,
                description: 'змяненні і diff',
              },
              {
                id: 'practical_use',
                label: 'практыка',
                weight: 0.33,
                description: 'рэальны прыклад',
              },
            ],
            redFlags: [
              { id: 'confuses_dom', label: 'Путае DOM', severity: 'medium' },
              { id: 'no_example', label: 'Без прыкладу', severity: 'high' },
            ],
            sampleGoodAnswer:
              'Сильны адказ тлумачыць віртуальны DOM і дае адзін канкрэтны прыклад.',
          },
        },
      },
      translateEnToRu: {
        summary: 'Translate full primary block en → ru',
        value: {
          mode: 'translate',
          locale: 'ru',
          question: {
            primaryLocale: 'en',
            questionText: 'Explain closures in JavaScript.',
            followUpQuestions: [
              'Can you walk through a simple practical example?',
              'What common pitfall would you avoid?',
            ],
            expectedConcepts: [
              {
                id: 'scope_chain',
                label: 'Scope chain',
                weight: 0.34,
                description: 'Candidate explains lexical scope.',
              },
              {
                id: 'lexical_env',
                label: 'Lexical environment',
                weight: 0.33,
                description: 'Binding and nesting.',
              },
              {
                id: 'practical_use',
                label: 'Practical use',
                weight: 0.33,
                description: 'Concrete example.',
              },
            ],
            redFlags: [
              { id: 'confuses_scope', label: 'Confuses scope', severity: 'medium' },
              { id: 'no_example', label: 'No example', severity: 'high' },
            ],
            sampleGoodAnswer:
              'A strong answer explains closures in plain language with one example.',
          },
        },
      },
    },
  })
  @ApiOkResponse({ type: QuestionDraftContentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  draftQuestion(
    @Body() dto: DraftQuestionDto,
    @CurrentLocale() headerLocale: Locale,
  ): Promise<QuestionDraft | QuestionDraftContent> {
    return this.aiService.draftQuestion(dto.question ?? {}, {
      bodyLocale: dto.locale,
      headerLocale,
      mode: dto.mode,
    });
  }
}
