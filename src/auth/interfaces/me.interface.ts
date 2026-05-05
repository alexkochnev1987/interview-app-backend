import { User } from '../../user/interfaces/user.interface';
import { Permission } from '../permissions';

export type MeResponse = Omit<User, 'passwordHash'> & {
  permissions: Permission[];
};
