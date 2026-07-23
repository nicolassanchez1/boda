// Edge-runtime compatible version of the admin cookie check.
// Mirrors src/lib/auth.ts but uses Web Crypto APIs (no node:crypto).
// Used by middleware.ts because Next.js middleware runs in Edge runtime by default.

const ADMIN_COOKIE = 'mella_admin';
const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    // Dev-only fallback. Middleware should never reach this in production because
    // the corresponding server actions guard against an empty AUTH_SECRET at boot.
    return 'dev-only-fallback-do-not-use-in-production';
  }
  return secret;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array {
  let padded = s.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verify(signed: string | undefined | null): Promise<string | null> {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);

  let decoded: Uint8Array;
  try {
    decoded = base64UrlDecode(sig);
  } catch {
    return null;
  }

  const key = await importKey();
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));

  return constantTimeEqual(decoded, expected) ? value : null;
}

export async function isAdminAuthedEdge(cookieValue: string | undefined | null): Promise<boolean> {
  return (await verify(cookieValue)) === 'admin';
}

export const ADMIN_COOKIE_NAME = ADMIN_COOKIE;
