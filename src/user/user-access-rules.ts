import {UserRole} from "./interfaces/user.interface";

export const USER_PROFILE_ACCESS_DENIED_MESSAGE = 'You do not have access to this user profile';

export interface UserProfileAccessActor {
    id: string;
    role: UserRole
}

export interface UserProfileAccessTarget {
    id: string;
    role: UserRole;
}

export function getUserProfileReadDenialReason(
    target: UserProfileAccessTarget,
    actor: UserProfileAccessActor
): string | null {
    if (actor.role === 'super_admin') return null;
    if (actor.role === 'admin' && target.role !== 'super_admin') return null;
    if (actor.role === 'hr' && (target.role === 'hr' || target.role === 'candidate')) return null;
    if (actor.role === 'candidate' && actor.id === target.id) return null;
    return USER_PROFILE_ACCESS_DENIED_MESSAGE;
}