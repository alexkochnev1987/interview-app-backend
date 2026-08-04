import {
  canRestoreGoogleAvatar,
  computeAvatarPictureUrl,
  resolveAvatarSourceOnGoogleLogin,
} from './avatar-picture-url';

describe('computeAvatarPictureUrl', () => {
  it('returns the proxy path when a custom avatar is uploaded', () => {
    expect(
      computeAvatarPictureUrl({
        userId: 'user-1',
        avatarSource: 'upload',
        avatarKey: 'uploads/avatars/user-1/1.png',
      }),
    ).toBe('/users/user-1/avatar?v=uploads%2Favatars%2Fuser-1%2F1.png');
  });

  it('changes the proxy url when the avatar key changes, busting stale caches', () => {
    const first = computeAvatarPictureUrl({
      userId: 'user-1',
      avatarSource: 'upload',
      avatarKey: 'uploads/avatars/user-1/1.png',
    });
    const second = computeAvatarPictureUrl({
      userId: 'user-1',
      avatarSource: 'upload',
      avatarKey: 'uploads/avatars/user-1/2.png',
    });
    expect(first).not.toBe(second);
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

describe('canRestoreGoogleAvatar', () => {
  it('is false when there is no Google picture on file', () => {
    expect(
      canRestoreGoogleAvatar({ avatarSource: 'upload', hasGoogleAvatar: false }),
    ).toBe(false);
  });

  it('is true when a custom upload is active and a Google picture is on file', () => {
    expect(
      canRestoreGoogleAvatar({ avatarSource: 'upload', hasGoogleAvatar: true }),
    ).toBe(true);
  });

  it('is true when the user has deleted down to initials but a Google picture is on file', () => {
    expect(
      canRestoreGoogleAvatar({ avatarSource: 'none', hasGoogleAvatar: true }),
    ).toBe(true);
  });

  it('is false when the Google picture is already the active source', () => {
    expect(
      canRestoreGoogleAvatar({ avatarSource: 'google', hasGoogleAvatar: true }),
    ).toBe(false);
  });
});

describe('resolveAvatarSourceOnGoogleLogin', () => {
  it('never clobbers an active custom upload', () => {
    expect(
      resolveAvatarSourceOnGoogleLogin({
        currentAvatarSource: 'upload',
        hadGooglePictureBefore: true,
      }),
    ).toBe('upload');
  });

  it("activates google on the account's first-ever Google login", () => {
    expect(
      resolveAvatarSourceOnGoogleLogin({
        currentAvatarSource: 'none',
        hadGooglePictureBefore: false,
      }),
    ).toBe('google');
  });

  it('keeps an explicit delete sticky across a later Google login', () => {
    expect(
      resolveAvatarSourceOnGoogleLogin({
        currentAvatarSource: 'none',
        hadGooglePictureBefore: true,
      }),
    ).toBe('none');
  });

  it('re-affirms google when it is already the active source', () => {
    expect(
      resolveAvatarSourceOnGoogleLogin({
        currentAvatarSource: 'google',
        hadGooglePictureBefore: true,
      }),
    ).toBe('google');
  });
});
