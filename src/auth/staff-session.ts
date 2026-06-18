import { CookieOptions } from 'express';

export const STAFF_SESSION_COOKIE = 'session';
export const STAFF_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function isLocalFrontend(): boolean {
  return (
    !process.env.FRONTEND_URL ||
    process.env.FRONTEND_URL.includes('localhost')
  );
}

export function getStaffSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: !isLocalFrontend(),
    sameSite: 'lax',
    path: '/',
    maxAge: STAFF_SESSION_TTL_MS,
  };
}
