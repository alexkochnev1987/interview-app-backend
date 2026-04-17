import { UserRole } from '../interfaces/user.interface';

export class CreateUserDto {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  organizationId?: string;
}
