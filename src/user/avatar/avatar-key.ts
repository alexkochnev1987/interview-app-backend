const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const SUPPORTED_AVATAR_CONTENT_TYPES = Object.keys(
  EXTENSION_BY_CONTENT_TYPE,
);

export const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export function extensionForAvatarContentType(
  contentType: string,
): string | undefined {
  return EXTENSION_BY_CONTENT_TYPE[contentType];
}

interface BuildUserAvatarKeyParams {
  prefix: string;
  userId: string;
  ext: string;
  timestamp?: number;
}

interface MatchesUserAvatarKeyParams {
  avatarKey: string;
  userId: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/` : '';
}

export function buildUserAvatarKey({
  prefix,
  userId,
  ext,
  timestamp = Date.now(),
}: BuildUserAvatarKeyParams): string {
  return `${normalizePrefix(prefix)}avatars/${userId}/${timestamp}.${ext}`;
}

export function matchesUserAvatarKey({
  avatarKey,
  userId,
}: MatchesUserAvatarKeyParams): boolean {
  const normalizedKey = avatarKey.trim();
  const extensionPattern = Object.values(EXTENSION_BY_CONTENT_TYPE)
    .map(escapeRegExp)
    .join('|');
  const pattern = new RegExp(
    `^(?:.*?/)?avatars/${escapeRegExp(userId)}/\\d+\\.(?:${extensionPattern})$`,
  );

  return pattern.test(normalizedKey);
}
