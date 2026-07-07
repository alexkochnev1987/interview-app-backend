import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { DemoProvisionResponseDto } from './dto/demo-provision.response.dto';
import { User } from './interfaces/user.interface';
import { UserService } from './user.service';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

import { AuthUserResponseDto } from '../auth/dto/auth-user.response.dto';

@ApiTags('users')
@ApiCookieAuth('sessionAuth')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ type: [AuthUserResponseDto] })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  list(@Query() query: ListUsersQueryDto): Promise<Omit<User, 'passwordHash'>[]> {
    return this.userService.listAll({ limit: query.limit, offset: query.offset });
  }

  @Patch(':id/role')
  @RequirePermissions('users:assign_role')
  @ApiOperation({ summary: 'Assign role to a user' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async assignRole(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: Omit<User, 'passwordHash'>,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.userService.assignRole(
      { id: actor.id, role: actor.role },
      targetId,
      dto.role,
    );
  }

  @Post('demo')
  @RequirePermissions('users:assign_role')
  @ApiOperation({
    summary: 'Provision the read-only demo account and demo content',
    description:
      'Idempotent admin-only setup for environments without direct database ' +
      'access. Refused on production unless ALLOW_DEMO_SEED=true is set, so it ' +
      'can never seed demo data into production by accident.',
  })
  @ApiCreatedResponse({ type: DemoProvisionResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  provisionDemo() {
    return this.userService.provisionDemo();
  }
}
