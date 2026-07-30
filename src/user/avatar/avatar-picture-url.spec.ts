import { computeAvatarPictureUrl } from './avatar-picture-url';

describe('computeAvatarPictureUrl', () => {
  it('returns the proxy path when a custom avatar is uploaded', () => {
    expect(
      computeAvatarPictureUrl({
        userId: 'user-1',
        avatarSource: 'upload',
        avatarKey: 'uploads/avatars/user-1/1.png',
      }),
    ).toBe('/users/user-1/avatar');
  });

  it('returns the raw Google URL when source is google', () => {
    expect(
      computeAvatarPictureUrl({
        userId: 'user-1',
        avatarSource: 'google',
        googlePictureUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
      }),
    ).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
  });

  it('returns undefined when source is none, even if a google url is stored', () => {
    expect(
      computeAvatarPictureUrl({
        userId: 'user-1',
        avatarSource: 'none',
        googlePictureUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when source is upload but the key is missing', () => {
    expect(
      computeAvatarPictureUrl({
        userId: 'user-1',
        avatarSource: 'upload',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when source is google but no url is stored', () => {
    expect(
      computeAvatarPictureUrl({
        userId: 'user-1',
        avatarSource: 'google',
      }),
    ).toBeUndefined();
  });
});
