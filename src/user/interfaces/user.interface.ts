export type UserRole = 'super_admin' | 'admin' | 'hr' | 'candidate';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  passwordHash: string;
  demo: boolean;
  createdAt: Date;
}
