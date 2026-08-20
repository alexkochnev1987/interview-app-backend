export type UserRole = 'super_admin' | 'admin' | 'hr' | 'candidate';

export const ONBOARDING_STATUSES = ['completed', 'skipped'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const AVATAR_SOURCES = ['none', 'google', 'upload'] as const;
export type AvatarSource = (typeof AVATAR_SOURCES)[number];

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
  avatarSource: AvatarSource;
  hasGoogleAvatar: boolean;
  avatarKey?: string;
  googlePictureUrl?: string;
  pictureUrl?: string;
}

export type ActingUser = Omit<User, 'passwordHash'>;
