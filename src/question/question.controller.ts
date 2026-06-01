import {
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
  ApiForbiddenResponse,
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
import { SimilarQuestionMatch } from './interfaces/question.interface';
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
  ResolvedQuestionResponseDto,
} from './dto/question.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

const QUESTION_QUERY_VALIDATION_PIPE = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
});

@ApiTags('questions')
@ApiCookieAuth('sessionAuth')
@Controller('questions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

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
  @ApiOperation({ summary: 'List questions (paginated, filterable, sortable)' })
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
      'Resolved single-locale shape for X-Locale (same as a list item). ' +
      '?includeTranslations=true adds the full translations map for the editor. ' +
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
  @ApiOperation({ summary: 'Create question' })
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
  @Patch(':id')
  @RequirePermissions('questions:update')
  @ApiOperation({ summary: 'Update question' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateQuestionDto })
  @ApiOkResponse({ type: ResolvedQuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
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
