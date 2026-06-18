import {
  CANDIDATE_SESSION_COOKIE,
  CANDIDATE_SESSION_TTL_MS,
  getCandidateSessionCookieOptions,
} from './candidate-session';

describe('candidate-session', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it('uses the candidate_session cookie name and 12h TTL', () => {
    expect(CANDIDATE_SESSION_COOKIE).toBe('candidate_session');
    expect(CANDIDATE_SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('marks cookies secure outside local frontend', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(getCandidateSessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: CANDIDATE_SESSION_TTL_MS,
    });
  });

  it('allows insecure cookies for local frontend', () => {
    delete process.env.FRONTEND_URL;
    expect(getCandidateSessionCookieOptions().secure).toBe(false);

    process.env.FRONTEND_URL = 'http://localhost:3001';
    expect(getCandidateSessionCookieOptions().secure).toBe(false);
  });
});
