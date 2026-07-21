export type UserRole = 'super_admin' | 'admin' | 'hr' | 'candidate';

export type OnboardingStatus = 'completed' | 'skipped';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  passwordHash: string;
  demo: boolean;
  onboardingCompletedAt?: Date;
  onboardingStatus?: OnboardingStatus;
  createdAt: Date;
}
