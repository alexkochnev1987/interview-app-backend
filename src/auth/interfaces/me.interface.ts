import { User } from '../../user/interfaces/user.interface';
import { Permission } from '../permissions';

export type MeResponse = Omit<User, 'passwordHash'> & {
  permissions: Permission[];
  /** Whether Herman is enabled for this user (DB → env → defaults via RecruiterAssistantConfigService). */
  recruiterAssistantEnabled: boolean;
};
