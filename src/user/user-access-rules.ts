import { UserRole } from './interfaces/user.interface';

export interface UserProfileAccessActor {
  id: string;
  role: UserRole;
}

export interface UserProfileAccessTarget {
  id: string;
  role: UserRole;
}

export function canReadUserProfile(
  target: UserProfileAccessTarget,
  actor: UserProfileAccessActor,
): boolean {
  if (actor.id === target.id) return true;
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'admin' && target.role !== 'super_admin') return true;
  if (actor.role === 'hr' && (target.role === 'hr' || target.role === 'candidate')) {
    return true;
  }
  return false;
}
