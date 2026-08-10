import { User } from '../../user/interfaces/user.interface';
import { Permission } from '../permissions';

export type MeResponse = Omit<User, 'passwordHash'> & {
  permissions: Permission[];
  /** Mirrors RECRUITER_ASSISTANT_ENABLED* env gates for this user's role. */
  recruiterAssistantEnabled: boolean;
};
