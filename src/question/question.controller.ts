import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
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
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  Question,
  SimilarQuestionMatch,
} from './interfaces/question.interface';
import { QuestionService } from './question.service';
import {
  BulkDeleteQuestionsResponseDto,
  DeleteQuestionResponseDto,
  FindSimilarResponseDto,
  QuestionResponseDto,
} from './dto/question.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

@ApiTags('questions')
@Controller('questions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Get()
  @RequirePermissions('questions:read')
  @ApiOperation({ summary: 'List questions' })
  @ApiOkResponse({ type: [QuestionResponseDto] })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  findAll(@CurrentUser() user: Omit<User, 'passwordHash'>): Promise<Question[]> {
    return this.questionService.findAll({
      includeDeleted: user.role === 'super_admin',
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
