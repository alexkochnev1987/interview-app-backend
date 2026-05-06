import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { User } from './interfaces/user.interface';
import { UserService } from './user.service';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

import { AuthUserResponseDto } from '../auth/dto/auth-user.response.dto';

@ApiTags('users')
@ApiBearerAuth()
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
}
