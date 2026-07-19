import { Locale } from '../../locale/locale.constants';
import { User } from '../../user/interfaces/user.interface';

export type ActingUser = Omit<User, 'passwordHash'>;

export interface ParsedRecruiterRequest {
  position: string;
  count: number;
  candidateName?: string;
  candidateEmail?: string;
  locale: Locale;
}
