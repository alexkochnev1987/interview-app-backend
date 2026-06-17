import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentLocale } from '../locale/decorators/current-locale.decorator';
import { Locale } from '../locale/locale.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User } from '../user/interfaces/user.interface';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { FindSimilarDto } from './dto/find-similar.dto';
import { GetQuestionQueryDto } from './dto/get-question-query.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  QuestionDraft,
  SimilarQuestionMatch,
} from './interfaces/question.interface';
import {
  PaginatedQuestions,
  QuestionFacets,
  QuestionService,
  ResolvedQuestion,
} from './question.service';
import {
  BulkDeleteQuestionsResponseDto,
  DeleteQuestionResponseDto,
  FindSimilarResponseDto,
  PaginatedQuestionsResponseDto,
  QuestionFacetsResponseDto,
  QuestionDraftResponseDto,
  QuestionDraftContentResponseDto,
  QuestionResponseDto,
  ResolvedQuestionResponseDto,
} from './dto/question.responses.dto';
import { QuestionTranslationDto } from './dto/question-translation.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { AiService } from '../ai/ai.service';
import { QuestionDraftContent } from '../ai/question-draft-content';
import { DraftQuestionDto } from '../ai/dto/ai.dto';

const QUESTION_QUERY_VALIDATION_PIPE = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
});

function questionUpdateRouteDecorators() {
  return applyDecorators(
    RequirePermissions('questions:update'),
    ApiOperation({
      summary: 'Update question',
      description:
        '`primaryLocale` is immutable — changing it returns 400. ' +
        'Default `translationsMode=merge` upserts locale keys; `replace` requires `translations` and replaces the entire map (removed locales disappear). ' +
        'Patching `translations[primaryLocale]` or using `replace` requires the full five-field primary block. Metadata-only patches are allowed when stored content stays valid.',
    }),
    ApiParam({ name: 'id' }),
    ApiBody({ type: UpdateQuestionDto }),
    ApiOkResponse({ type: ResolvedQuestionResponseDto }),
    ApiUnauthorizedResponse({ type: ApiErrorResponseDto }),
    ApiForbiddenResponse({ type: ApiErrorResponseDto }),
    ApiBadRequestResponse({ type: ApiErrorResponseDto }),
    ApiNotFoundResponse({ type: ApiErrorResponseDto }),
  );
}

@ApiTags('questions')
@ApiCookieAuth('sessionAuth')
@ApiExtraModels(QuestionResponseDto, QuestionTranslationDto)
@Controller('questions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly aiService: AiService,
  ) {}

  private effectiveQuestionsQuery(
    user: Omit<User, 'passwordHash'>,
    query: QueryQuestionsDto,
  ): QueryQuestionsDto {
    if (user.role === 'super_admin' && !query.status) {
      return { ...query, status: 'all' };
    }
    return query;
  }

  @Get()
  @RequirePermissions('questions:read')
  @ApiOperation({
    summary: 'List questions (paginated, filterable, sortable)',
    description:
      'Filter by translation availability with `?locale=` (primaryLocale match or non-empty `translations[locale].questionText`); list items resolve rubric for that locale when set, otherwise for `X-Locale` (default `en`). ' +
      'Use `?primaryLocale=` for canonical locale only. Deprecated: `?outputLanguage=`. ' +
      'Pass `?includeTranslations=true` for the full map per item.',
  })
  @ApiOkResponse({ type: PaginatedQuestionsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  findAll(
    @Query(QUESTION_QUERY_VALIDATION_PIPE) query: QueryQuestionsDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @CurrentLocale() locale: Locale,
  ): Promise<PaginatedQuestions> {
    return this.questionService.findAll(this.effectiveQuestionsQuery(user, query), {
      forceActive: user.role !== 'super_admin',
      resolveLocale: locale,
    });
  }

  @Post('ai/draft')
  @RequirePermissions('questions:create')
  @ApiOperation({
    summary: 'Generate AI question draft',
    description:
      'Generates a question draft in locale from body `locale` or X-Locale header. ' +
      'If `mode=translate`, translates the full primary content block from `question.primaryLocale` to body `locale` (requires both locales and the complete primary rubric; preserves concept/red-flag ids 1:1). If `mode=generate`, builds the primary locale content block (questionText + rubric) in the target locale; metadata fields on the seed are context only and are not returned. Does not persist anything to the database.',
  })
  @ApiHeader({
    name: 'X-Locale',
    required: false,
    description: 'Used when body `locale` is omitted. Defaults to `en`.',
  })
  @ApiBody({
    type: DraftQuestionDto,
    examples: {
      polishGenerate: {
        summary: 'Generate full rubric in Polish',
        value: {
          locale: 'pl',
          mode: 'generate',
          question: {
            questionText: 'Wyjaśnij działanie hooków w React.',
            category: 'react',
          },
        },
      },
      translateRuToPl: {
        summary: 'Translate full primary block ru → pl',
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
    },
  })
  @ApiOkResponse({ type: QuestionDraftContentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  draftQuestion(
    @Body() dto: DraftQuestionDto,
    @CurrentLocale() locale: Locale,
  ): Promise<QuestionDraft | QuestionDraftContent> {
    return this.aiService.draftQuestion(dto.question ?? {}, {
      bodyLocale: dto.locale,
      headerLocale: locale,
      mode: dto.mode,
    });
  }

  @Get('facets')
  @RequirePermissions('questions:read')
  @ApiOperation({
    summary: 'Faceted counts for the picker sidebar',
    description:
      'Returns each filter facet (difficulty / category / subcategory / role / tags) with a per-value count. ' +
      'Uses the same query filters as GET /questions (including ?locale=, ?primaryLocale=, ?q=, tags, status). ' +
      'Deprecated: ?outputLanguage= (use primaryLocale). ' +
      'The facet being counted is omitted from the filter so counts show remaining options.',
  })
  @ApiOkResponse({ type: QuestionFacetsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  getFacets(
    @Query(QUESTION_QUERY_VALIDATION_PIPE) query: QueryQuestionsDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<QuestionFacets> {
    return this.questionService.getFacets(this.effectiveQuestionsQuery(user, query), {
      forceActive: user.role !== 'super_admin',
    });
  }

  @Get(':id')
  @RequirePermissions('questions:read')
  @ApiOperation({
    summary: 'Get question by id',
    description:
      'Nested editor shape: `primaryLocale`, flat metadata, resolved rubric for `X-Locale`, and `translations` map (omit with `?includeTranslations=false`). ' +
      'Legacy rows with only `outputLanguage` and flat columns map to `primaryLocale` and hydrate the primary translation block on read. ' +
      'Non–super-admin callers receive 404 for soft-deleted questions.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ResolvedQuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id') id: string,
    @Query(QUESTION_QUERY_VALIDATION_PIPE) query: GetQuestionQueryDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @CurrentLocale() locale: Locale,
  ): Promise<ResolvedQuestion> {
    return this.questionService.findOneResolved(id, locale, {
      includeDeleted: user.role === 'super_admin',
      includeTranslations: query.includeTranslations,
    });
  }

  @Post()
  @RequirePermissions('questions:create')
  @ApiOperation({
    summary: 'Create question',
    description:
      'Requires `primaryLocale` (en|be|ru|pl) and a full `translations[primaryLocale]` block ' +
      '(questionText, followUpQuestions, expectedConcepts, redFlags, sampleGoodAnswer). ' +
      'Metadata fields (role, category, tags, …) are stored flat on the question row.',
  })
  @ApiBody({ type: CreateQuestionDto })
  @ApiOkResponse({ type: ResolvedQuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateQuestionDto,
    @CurrentLocale() locale: Locale,
  ): Promise<ResolvedQuestion> {
    return this.questionService.createResolved(dto, locale);
  }

  @Post('similar')
  @RequirePermissions('questions:read')
  @ApiOperation({
    summary: 'Find similar questions',
    description:
      'Embedding search; each match question is resolved for X-Locale. Match reasons use the same locale.',
  })
  @ApiBody({ type: FindSimilarDto })
  @ApiOkResponse({ type: FindSimilarResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async findSimilar(
    @Body() dto: FindSimilarDto,
    @CurrentLocale() locale: Locale,
  ): Promise<{ matches: SimilarQuestionMatch[] }> {
    const matches = await this.questionService.findSimilar(
      dto.draft ?? {},
      dto.limit ?? 5,
      dto.excludeQuestionId,
      locale,
    );
    return { matches };
  }

  @Put(':id')
  @questionUpdateRouteDecorators()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentLocale() locale: Locale,
  ): Promise<ResolvedQuestion> {
    return this.questionService.updateResolved(id, dto, locale);
  }

  @Patch(':id')
  @questionUpdateRouteDecorators()
  patchUpdate(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentLocale() locale: Locale,
  ): Promise<ResolvedQuestion> {
    return this.questionService.updateResolved(id, dto, locale);
  }

  @Delete(':id')
  @RequirePermissions('questions:delete')
  @ApiOperation({ summary: 'Soft delete question' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: DeleteQuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  remove(
    @Param('id') id: string,
  ): Promise<{ id: string; deleted: true }> {
    return this.questionService.softDelete(id);
  }

  @Post('bulk-delete')
  @RequirePermissions('questions:delete')
  @ApiOperation({
    summary: 'Soft delete questions in bulk',
    description: 'Blocked items include questionText resolved for X-Locale.',
  })
  @ApiBody({ type: BulkDeleteQuestionsDto })
  @ApiOkResponse({ type: BulkDeleteQuestionsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  bulkRemove(
    @Body() dto: BulkDeleteQuestionsDto,
    @CurrentLocale() locale: Locale,
  ): Promise<{
    deleted: string[];
    blocked: Array<{ id: string; questionText: string; reason: string }>;
  }> {
    return this.questionService.softDeleteMany(dto.ids, locale);
  }

  @Patch(':id/restore')
  @RequirePermissions('questions:delete')
  @ApiOperation({ summary: 'Restore soft deleted question' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ResolvedQuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  restore(
    @Param('id') id: string,
    @Query(QUESTION_QUERY_VALIDATION_PIPE) query: GetQuestionQueryDto,
    @CurrentLocale() locale: Locale,
  ): Promise<ResolvedQuestion> {
    return this.questionService.restoreResolved(id, locale, {
      includeTranslations: query.includeTranslations,
    });
  }
}
