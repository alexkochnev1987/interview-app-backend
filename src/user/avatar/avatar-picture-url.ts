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
    return `/users/${userId}/avatar`;
  }
  if (avatarSource === 'google' && googlePictureUrl) {
    return googlePictureUrl;
  }
  return undefined;
}
