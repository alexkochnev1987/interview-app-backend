import {
  getStaffSessionCookieOptions,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_MS,
} from './staff-session';

describe('staff-session', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it('uses the session cookie name and 24h TTL', () => {
    expect(STAFF_SESSION_COOKIE).toBe('session');
    expect(STAFF_SESSION_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('marks cookies secure outside local frontend', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(getStaffSessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: STAFF_SESSION_TTL_MS,
    });
  });

  it('allows insecure cookies for localhost frontend', () => {
    process.env.FRONTEND_URL = 'http://localhost:3001';
    expect(getStaffSessionCookieOptions().secure).toBe(false);
  });
});
