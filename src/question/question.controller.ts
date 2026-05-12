import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User } from '../user/interfaces/user.interface';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { FindSimilarDto } from './dto/find-similar.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  Question,
  SimilarQuestionMatch,
} from './interfaces/question.interface';
import { PaginatedQuestions, QuestionFacets, QuestionService } from './question.service';
import {
  BulkDeleteQuestionsResponseDto,
  DeleteQuestionResponseDto,
  FindSimilarResponseDto,
  PaginatedQuestionsResponseDto,
  QuestionFacetsResponseDto,
  QuestionResponseDto,
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

  @Get()
  @RequirePermissions('questions:read')
  @ApiOperation({ summary: 'List questions (paginated, filterable, sortable)' })
  @ApiOkResponse({ type: PaginatedQuestionsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  findAll(
    @Query(QUESTION_QUERY_VALIDATION_PIPE) query: QueryQuestionsDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<PaginatedQuestions> {
    return this.questionService.findAll(query, {
      forceActive: user.role !== 'super_admin',
    });
  }

  @Get('facets')
  @RequirePermissions('questions:read')
  @ApiOperation({
    summary: 'Faceted counts for the picker sidebar',
    description:
      'Returns each filter facet (difficulty / category / subcategory / role / tags) with a per-value count. Counts respect every other filter on the request so the user sees what is still available before clicking.',
  })
  @ApiOkResponse({ type: QuestionFacetsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  getFacets(
    @Query(QUESTION_QUERY_VALIDATION_PIPE) query: QueryQuestionsDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<QuestionFacets> {
    return this.questionService.getFacets(query, {
      forceActive: user.role !== 'super_admin',
    });
  }

  @Get(':id')
  @RequirePermissions('questions:read')
  @ApiOperation({ summary: 'Get question by id' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: QuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<Question> {
    return this.questionService.findOne(id, {
      includeDeleted: user.role === 'super_admin',
    });
  }

  @Post()
  @RequirePermissions('questions:create')
  @ApiOperation({ summary: 'Create question' })
  @ApiBody({ type: CreateQuestionDto })
  @ApiOkResponse({ type: QuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  create(@Body() dto: CreateQuestionDto): Promise<Question> {
    return this.questionService.create(dto);
  }

  @Post('similar')
  @RequirePermissions('questions:read')
  @ApiOperation({ summary: 'Find similar questions' })
  @ApiBody({ type: FindSimilarDto })
  @ApiOkResponse({ type: FindSimilarResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async findSimilar(
    @Body() dto: FindSimilarDto,
  ): Promise<{ matches: SimilarQuestionMatch[] }> {
    const matches = await this.questionService.findSimilar(
      dto.draft ?? {},
      dto.limit ?? 5,
      dto.excludeQuestionId,
    );
    return { matches };
  }

  @Patch(':id')
  @RequirePermissions('questions:update')
  @ApiOperation({ summary: 'Update question' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateQuestionDto })
  @ApiOkResponse({ type: QuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<Question> {
    return this.questionService.update(id, dto);
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
  @ApiOperation({ summary: 'Soft delete questions in bulk' })
  @ApiBody({ type: BulkDeleteQuestionsDto })
  @ApiOkResponse({ type: BulkDeleteQuestionsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  bulkRemove(@Body() dto: BulkDeleteQuestionsDto): Promise<{
    deleted: string[];
    blocked: Array<{ id: string; questionText: string; reason: string }>;
  }> {
    return this.questionService.softDeleteMany(dto.ids);
  }

  @Patch(':id/restore')
  @RequirePermissions('questions:delete')
  @ApiOperation({ summary: 'Restore soft deleted question' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: QuestionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  restore(@Param('id') id: string): Promise<Question> {
    return this.questionService.restore(id);
  }
}
