import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
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
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { ResolvedQuestionResponseDto } from '../question/dto/question.responses.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import {
  DeleteTemplateResponseDto,
  TemplateResponseDto,
} from './dto/template.responses.dto';
import { TemplateService, TemplateWithQuestions } from './template.service';

@ApiTags('templates')
@ApiCookieAuth('sessionAuth')
@ApiExtraModels(TemplateResponseDto, ResolvedQuestionResponseDto)
@Controller('templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  @RequirePermissions('templates:read')
  @ApiOperation({
    summary: 'List interview templates',
    description:
      'Returns all templates in the caller demo scope, most-recently-updated ' +
      'first. Each template resolves its stored question ids to live questions ' +
      'for X-Locale; deleted/pending references are excluded from the count.',
  })
  @ApiOkResponse({ type: [TemplateResponseDto] })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  findAll(
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @CurrentLocale() locale: Locale,
  ): Promise<TemplateWithQuestions[]> {
    return this.templateService.findAll(locale, { demo: user.demo });
  }

  @Get(':id')
  @RequirePermissions('templates:read')
  @ApiOperation({
    summary: 'Get an interview template by id',
    description:
      'Resolves the stored question ids to live question rows for X-Locale so ' +
      'the response can seed the interview question picker.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: TemplateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @CurrentLocale() locale: Locale,
  ): Promise<TemplateWithQuestions> {
    return this.templateService.findOne(id, locale, { demo: user.demo });
  }

  @Post()
  @RequirePermissions('templates:create')
  @ApiOperation({
    summary: 'Create an interview template',
    description:
      'Requires a name and at least one question id. questionIds are stored as ' +
      'live references (ordered), resolved to current questions on read.',
  })
  @ApiBody({ type: CreateTemplateDto })
  @ApiOkResponse({ type: TemplateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @CurrentLocale() locale: Locale,
  ): Promise<TemplateWithQuestions> {
    return this.templateService.create(dto, locale, {
      createdById: user.id,
      demo: user.demo,
    });
  }

  @Put(':id')
  @RequirePermissions('templates:update')
  @ApiOperation({ summary: 'Update an interview template (PUT and PATCH are equivalent)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiOkResponse({ type: TemplateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @CurrentLocale() locale: Locale,
  ): Promise<TemplateWithQuestions> {
    return this.applyUpdate(id, dto, user, locale);
  }

  @Patch(':id')
  @RequirePermissions('templates:update')
  @ApiOperation({ summary: 'Update an interview template (PUT and PATCH are equivalent)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiOkResponse({ type: TemplateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  patchUpdate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
    @CurrentLocale() locale: Locale,
  ): Promise<TemplateWithQuestions> {
    return this.applyUpdate(id, dto, user, locale);
  }

  // PUT and PATCH share one behaviour; both routes funnel here so they can't drift.
  private applyUpdate(
    id: string,
    dto: UpdateTemplateDto,
    user: Omit<User, 'passwordHash'>,
    locale: Locale,
  ): Promise<TemplateWithQuestions> {
    return this.templateService.update(id, dto, locale, { demo: user.demo });
  }

  @Delete(':id')
  @RequirePermissions('templates:delete')
  @ApiOperation({ summary: 'Delete an interview template' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: DeleteTemplateResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<{ id: string; deleted: true }> {
    return this.templateService.remove(id, { demo: user.demo });
  }
}
