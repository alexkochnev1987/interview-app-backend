import { AvatarSource } from '../interfaces/user.interface';

interface ComputeAvatarPictureUrlParams {
  userId: string;
  avatarSource: AvatarSource;
  avatarKey?: string;
  googlePictureUrl?: string;
}

/**
 * Resolves the single `pictureUrl` exposed on API responses from the three
 * raw avatar columns. `avatarSource` is the source of truth: a custom upload
 * always wins over a stored Google URL, and an explicit 'none' (e.g. after
 * delete) must never fall back to a Google photo that's still on the row.
 */
export function computeAvatarPictureUrl({
  userId,
  avatarSource,
  avatarKey,
  googlePictureUrl,
}: ComputeAvatarPictureUrlParams): string | undefined {
  if (avatarSource === 'upload' && avatarKey) {
    return `/users/${userId}/avatar?v=${encodeURIComponent(avatarKey)}`;
  }
  if (avatarSource === 'google' && googlePictureUrl) {
    return googlePictureUrl;
  }
  return undefined;
}

interface CanRestoreGoogleAvatarParams {
  avatarSource: AvatarSource;
  hasGoogleAvatar: boolean;
}

/**
 * Whether the "Restore Google picture" option should be offered: there must
 * be a Google photo on file, and it must not already be the active source
 * (covers both an active upload and a previously-deleted 'none' state).
 */
export function canRestoreGoogleAvatar({
  avatarSource,
  hasGoogleAvatar,
}: CanRestoreGoogleAvatarParams): boolean {
  return hasGoogleAvatar && avatarSource !== 'google';
}

interface ResolveAvatarSourceOnGoogleLoginParams {
  currentAvatarSource: AvatarSource;
  hadGooglePictureBefore: boolean;
}

/**
 * Decides the avatar_source to apply on every Google login. A custom upload
 * is never clobbered. An explicit 'none' (the user deleted their picture) is
 * only preserved when the row already had a Google picture before this login
 * — that's what distinguishes "user opted out" from "first time linking
 * Google", which also starts from 'none' but must activate 'google'.
 */
export function resolveAvatarSourceOnGoogleLogin({
  currentAvatarSource,
  hadGooglePictureBefore,
}: ResolveAvatarSourceOnGoogleLoginParams): AvatarSource {
  if (currentAvatarSource === 'upload') return 'upload';
  if (currentAvatarSource === 'none' && hadGooglePictureBefore) return 'none';
  return 'google';
}
