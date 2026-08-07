import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { apiBadRequest, apiNotFound } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { AppConfigService, AppVariableRecord } from './app-config.service';
import { UpsertConfigVariableDto } from './dto/upsert-config-variable.dto';
import { SystemConfigEntryDto } from './dto/system-config-entry.dto';
import { SYSTEM_CONFIG_DEFAULTS } from './app-config-defaults';

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

const SECRET_MASK = '********';

/** Mask the value field for secret variables in admin list responses. */
function maskSecrets(record: AppVariableRecord): AppVariableRecord {
  if (record.isSecret) {
    return { ...record, value: SECRET_MASK };
  }
  return record;
}

// ---------------------------------------------------------------------------
// Public config controller (accessible to everyone)
// ---------------------------------------------------------------------------

@ApiTags('config')
@Controller('config/public')
export class PublicConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get public runtime variables',
    description:
      'Returns a key→value dictionary of all variables marked as public (is_public=true). ' +
      'Available to all users including unauthenticated visitors.',
  })
  @ApiOkResponse({ description: 'Public configuration dictionary' })
  getPublicConfig(): Promise<Record<string, unknown>> {
    return this.appConfig.getPublicVariables();
  }
}

// ---------------------------------------------------------------------------
// Admin config controller (super_admin only)
// ---------------------------------------------------------------------------

@ApiTags('config')
@ApiCookieAuth('sessionAuth')
@Controller('config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AppConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Get()
  @RequirePermissions('config:manage')
  @ApiOperation({
    summary: 'List all runtime variables',
    description:
      'Returns the full list of runtime configuration variables. ' +
      'Secret variable values are masked with "********".',
  })
  @ApiOkResponse({
    type: [SystemConfigEntryDto],
    description: 'List of all configuration variables',
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listAll(): Promise<AppVariableRecord[]> {
    const variables = await this.appConfig.getAllVariables();
    return variables.map(maskSecrets);
  }

  @Put(':key')
  @RequirePermissions('config:manage')
  @ApiOperation({
    summary: 'Create or update a runtime variable',
    description:
      'Upserts a variable in the database. The new value takes effect ' +
      'within 15 seconds across all running Fargate instances. ' +
      'Overrides any value set in .env or process.env.',
  })
  @ApiParam({ name: 'key', description: 'Variable key in UPPER_SNAKE_CASE' })
  @ApiOkResponse({
    type: SystemConfigEntryDto,
    description: 'The saved variable record',
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertConfigVariableDto,
    @CurrentUser() actor: Omit<User, 'passwordHash'>,
  ): Promise<AppVariableRecord> {
    const existing = await this.appConfig.getVariableRecord(key);
    const defaultEntry = SYSTEM_CONFIG_DEFAULTS[key];
    const allowedOptions = dto.options ?? existing?.options ?? defaultEntry?.options;

    if (allowedOptions && allowedOptions.length > 0) {
      if (!allowedOptions.includes(dto.value)) {
        throw apiBadRequest(
          ApiErrorCode.INVALID_CONFIG_VALUE,
          `Value "${dto.value}" is not allowed for key ${key}. Allowed values: ${allowedOptions.join(', ')}.`,
        );
      }
    }

    const record = await this.appConfig.setVariable(key, dto.value, {
      valueType: dto.valueType ?? existing?.valueType ?? defaultEntry?.valueType,
      options: dto.options ?? existing?.options ?? defaultEntry?.options,
      isPublic: dto.isPublic ?? existing?.isPublic ?? defaultEntry?.isPublic,
      isSecret: dto.isSecret ?? existing?.isSecret ?? defaultEntry?.isSecret,
      description: dto.description ?? existing?.description ?? defaultEntry?.description,
      updatedBy: actor.email,
    });
    return maskSecrets(record);
  }

  @Delete(':key')
  @RequirePermissions('config:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a runtime variable override',
    description:
      'Removes the variable from the database. The application falls back ' +
      'to reading from process.env / .env or the code-level default.',
  })
  @ApiParam({ name: 'key', description: 'Variable key to reset' })
  @ApiNoContentResponse({ description: 'Variable deleted successfully' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async remove(@Param('key') key: string): Promise<void> {
    const deleted = await this.appConfig.deleteVariable(key);
    if (!deleted) {
      throw apiNotFound(
        ApiErrorCode.NOT_FOUND,
        `Configuration variable "${key}" not found`,
      );
    }
  }
}
