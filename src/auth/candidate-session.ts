import { CookieOptions } from 'express';

export const CANDIDATE_SESSION_COOKIE = 'candidate_session';
export const CANDIDATE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function isLocalFrontend(): boolean {
  return (
    !process.env.FRONTEND_URL ||
    process.env.FRONTEND_URL.includes('localhost')
  );
}

export function getCandidateSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: !isLocalFrontend(),
    sameSite: 'lax',
    path: '/',
    maxAge: CANDIDATE_SESSION_TTL_MS,
  };
}
