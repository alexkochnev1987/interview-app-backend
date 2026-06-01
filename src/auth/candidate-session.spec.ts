import {
  CANDIDATE_SESSION_COOKIE,
  CANDIDATE_SESSION_TTL_MS,
  getCandidateSessionCookieOptions,
} from './candidate-session';

describe('candidate-session', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it('exposes cookie name and twelve-hour TTL', () => {
    expect(CANDIDATE_SESSION_COOKIE).toBe('candidate_session');
    expect(CANDIDATE_SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('uses secure cookies outside localhost', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(getCandidateSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: CANDIDATE_SESSION_TTL_MS,
    });
  });

  it('allows non-secure cookies for local frontend', () => {
    process.env.FRONTEND_URL = 'http://localhost:3001';
    expect(getCandidateSessionCookieOptions().secure).toBe(false);
  });
});
