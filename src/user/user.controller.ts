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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { User } from './interfaces/user.interface';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions('users:read')
  list(@Query() query: ListUsersQueryDto): Promise<Omit<User, 'passwordHash'>[]> {
    return this.userService.listAll({ limit: query.limit, offset: query.offset });
  }

  @Patch(':id/role')
  @RequirePermissions('users:assign_role')
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
