export type UserRole = 'super_admin' | 'admin' | 'hr';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  passwordHash: string;
  createdAt: Date;
}
