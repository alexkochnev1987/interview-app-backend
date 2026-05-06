import { IsIn } from 'class-validator';
import { ALL_ROLES } from '../../auth/role-policy';
import { UserRole } from '../interfaces/user.interface';

export class AssignRoleDto {
  @IsIn(ALL_ROLES as readonly string[])
  role!: UserRole;
}
