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
