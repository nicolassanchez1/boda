// Locale-aware formatting (es-CO) for guest-facing strings.

const dateFmt = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatWeddingDate(input: string | null | undefined): string {
  if (!input) return '';
  // Input is a free-form display string from NEXT_PUBLIC_WEDDING_DATE — pass through.
  return input;
}

export function formatDeadline(input: string | null | undefined): string {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

export function formatSpanishDate(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return dateFmt.format(d);
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

// Turns a guest name into a URL-friendly slug: strips accents, lowercases,
// collapses anything non-alphanumeric to single dashes. Used only for the
// human-readable prefix of the invitation URL — NOT for lookup.
export function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    // After NFD, an accent like "é" becomes "e" + a non-ASCII combining mark.
    // Dropping non-ASCII removes the mark and keeps the base letter (josé→jose).
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// The invitation token is what authenticates a guest, so it stays in the URL as
// the final segment. The name is a friendly prefix: `/invitacion/carlos-e-hijos-Vecr5RCD`.
export function buildInvitationLink(baseUrl: string, token: string, guestName?: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const slug = guestName ? slugifyName(guestName) : '';
  const path = slug ? `${slug}-${token}` : token;
  return `${base}/invitacion/${path}`;
}

// Recovers the token from an invitation slug. Tokens never contain a dash
// (see tokens.ts alphabet), so the token is always the last dash-group — the
// name prefix can have any number of dashes.
export function extractInvitationToken(slug: string): string {
  const parts = slug.split('-');
  return parts[parts.length - 1] || slug;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  // wa.me requires the number in international format with no +, spaces, or dashes.
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
