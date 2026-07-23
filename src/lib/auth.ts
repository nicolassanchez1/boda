// Admin auth — single password from ADMIN_PASSWORD, persisted in a signed httpOnly cookie.
//
// Why a custom signed cookie instead of next-auth? The spec asks for a simple
// single-password gate with no user table. A small HMAC-signed token keeps the
// surface area tiny and avoids pulling in a framework.
//
// Cookie format: "<value>.<HMAC-SHA256(value)>" where value is the literal "admin".
// The signature is base64url-encoded and compared with timing-safe equality.
//
// AUTH_SECRET must be set in production. We refuse to start if it's missing outside dev.

import crypto from 'node:crypto';

const ADMIN_COOKIE = 'mella_admin';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set (min 16 chars) in production.');
    }
    // Dev-only fallback so a fresh checkout can boot. Log a warning.
    // eslint-disable-next-line no-console
    console.warn('[auth] AUTH_SECRET is unset — using insecure dev fallback.');
    return 'dev-only-fallback-do-not-use-in-production';
  }
  return secret;
}

function sign(value: string): string {
  const sig = crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
  return `${value}.${sig}`;
}

function verify(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);

  const expected = crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export function checkAdminPassword(input: string | undefined | null): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function buildAdminCookie(): {
  name: string;
  value: string;
  options: { httpOnly: boolean; sameSite: 'lax'; path: string; maxAge: number; secure: boolean };
} {
  return {
    name: ADMIN_COOKIE,
    value: sign('admin'),
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === 'production',
    },
  };
}

export function clearAdminCookie(): {
  name: string;
  value: string;
  options: { httpOnly: boolean; sameSite: 'lax'; path: string; maxAge: number; secure: boolean };
} {
  return {
    name: ADMIN_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      secure: process.env.NODE_ENV === 'production',
    },
  };
}

export function isAdminAuthed(cookieValue: string | undefined | null): boolean {
  return verify(cookieValue) === 'admin';
}

export const ADMIN_COOKIE_NAME = ADMIN_COOKIE;
