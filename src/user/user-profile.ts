import { UserRole } from './interfaces/user.interface';
import { UserProfileAccessActor } from './user-access-rules';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  pictureUrl?: string;
}

export function toUserProfileForActor(
  actor: UserProfileAccessActor,
  target: {
    id: string;
    name: string;
    role: UserRole;
    email: string;
    pictureUrl?: string;
  },
): UserProfile {
  const profile: UserProfile = {
    id: target.id,
    name: target.name,
    role: target.role,
    pictureUrl: target.pictureUrl,
  };
  if (
    actor.id === target.id ||
    actor.role === 'super_admin' ||
    (actor.role === 'admin' && target.role !== 'super_admin')
  ) {
    profile.email = target.email;
  }
  return profile;
}
