import {
  buildUserAvatarKey,
  extensionForAvatarContentType,
  matchesUserAvatarKey,
} from './avatar-key';

describe('avatar-key', () => {
  describe('extensionForAvatarContentType', () => {
    it('maps supported content types to extensions', () => {
      expect(extensionForAvatarContentType('image/jpeg')).toBe('jpg');
      expect(extensionForAvatarContentType('image/png')).toBe('png');
      expect(extensionForAvatarContentType('image/webp')).toBe('webp');
    });

    it('returns undefined for unsupported content types', () => {
      expect(extensionForAvatarContentType('video/webm')).toBeUndefined();
      expect(extensionForAvatarContentType('image/gif')).toBeUndefined();
    });
  });

  describe('buildUserAvatarKey', () => {
    it('builds a key scoped to the user id', () => {
      const key = buildUserAvatarKey({
        prefix: 'uploads',
        userId: 'user-1',
        ext: 'png',
        timestamp: 1700000000000,
      });

      expect(key).toBe('uploads/avatars/user-1/1700000000000.png');
    });

    it('normalizes an empty prefix', () => {
      const key = buildUserAvatarKey({
        prefix: '',
        userId: 'user-1',
        ext: 'jpg',
        timestamp: 1,
      });

      expect(key).toBe('avatars/user-1/1.jpg');
    });
  });

  describe('matchesUserAvatarKey', () => {
    it('matches a key built for the same user', () => {
      const avatarKey = buildUserAvatarKey({
        prefix: 'uploads',
        userId: 'user-1',
        ext: 'webp',
        timestamp: 1700000000000,
      });

      expect(matchesUserAvatarKey({ avatarKey, userId: 'user-1' })).toBe(true);
    });

    it('rejects a key built for a different user', () => {
      const avatarKey = buildUserAvatarKey({
        prefix: 'uploads',
        userId: 'user-1',
        ext: 'webp',
        timestamp: 1700000000000,
      });

      expect(matchesUserAvatarKey({ avatarKey, userId: 'user-2' })).toBe(false);
    });

    it('rejects an unsupported extension', () => {
      expect(
        matchesUserAvatarKey({
          avatarKey: 'uploads/avatars/user-1/123.gif',
          userId: 'user-1',
        }),
      ).toBe(false);
    });

    it('rejects a forged path outside the avatars namespace', () => {
      expect(
        matchesUserAvatarKey({
          avatarKey: 'uploads/interviews/user-1/answers/q0-camera-1.webm',
          userId: 'user-1',
        }),
      ).toBe(false);
    });
  });
});
