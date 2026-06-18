import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ALL_ROLES } from '../../auth/role-policy';
import { UserRole } from '../interfaces/user.interface';

export class AssignRoleDto {
  @ApiProperty({ enum: ALL_ROLES })
  @IsIn(ALL_ROLES as readonly string[])
  role!: UserRole;
}
