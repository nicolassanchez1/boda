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

export function buildInvitationLink(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/i/${token}`;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  // wa.me requires the number in international format with no +, spaces, or dashes.
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
