'use server';

// Admin server actions. Every mutation is guarded by:
//   1. Cookie-based admin auth (see ensureAdmin).
//   2. Zod validation of inputs.
// Middleware already blocks unauthenticated requests to /admin/*, but we
// double-check here in case the cookie is stale.

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ADMIN_COOKIE_NAME, isAdminAuthed } from '@/lib/auth';
import { generateUniqueToken } from '@/lib/tokens';
import {
  bulkCreateSchema,
  createInvitationSchema,
  deleteGiftSchema,
  deleteInvitationSchema,
  deleteMenuItemSchema,
  manualReserveGiftSchema,
  reorderGiftsSchema,
  reorderMenuSchema,
  updateInvitationSchema,
  upsertGiftSchema,
  upsertMenuItemSchema,
} from '@/lib/validation';

export type AdminActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

function ensureAdmin(): boolean {
  const c = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return isAdminAuthed(c);
}

function fail(error: string): AdminActionResult {
  return { ok: false, error };
}

// --- Invitations --------------------------------------------------------------

export async function createInvitation(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = createInvitationSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  const token = await generateUniqueToken();
  const inv = await prisma.invitation.create({
    data: {
      token,
      guestName: parsed.guestName,
      cupos: parsed.cupos,
      phone: parsed.phone ?? null,
      notes: parsed.notes ?? null,
    },
  });
  revalidatePath('/admin');
  return { ok: true, data: { id: inv.id, token: inv.token } };
}

export async function updateInvitation(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = updateInvitationSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  await prisma.invitation.update({
    where: { id: parsed.id },
    data: {
      guestName: parsed.guestName,
      cupos: parsed.cupos,
      phone: parsed.phone ?? null,
      notes: parsed.notes ?? null,
    },
  });
  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteInvitation(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = deleteInvitationSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  // Cascades to attendees and gifts.reservedById becomes null only if we set it.
  // We want to release any gifts this invitation holds and delete attendees.
  await prisma.$transaction(async (tx) => {
    await tx.gift.updateMany({
      where: { reservedById: parsed.id },
      data: { reservedById: null, reservedAt: null },
    });
    await tx.invitation.delete({ where: { id: parsed.id } });
  });
  revalidatePath('/admin');
  revalidatePath('/admin/regalos');
  return { ok: true };
}

export async function bulkCreateInvitations(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = bulkCreateSchema.parse(rawInput);
  } catch {
    return fail('Pega líneas con formato "Nombre, cupos".');
  }

  const lines = parsed.lines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return fail('No hay líneas válidas.');

  const created: { token: string; guestName: string; cupos: number }[] = [];
  const failed: { line: string; reason: string }[] = [];

  for (const line of lines) {
    // Split on first comma. We allow ", " and ",".
    const idx = line.indexOf(',');
    if (idx < 0) {
      failed.push({ line, reason: 'Falta la coma.' });
      continue;
    }
    const name = line.slice(0, idx).trim();
    const cuposRaw = line.slice(idx + 1).trim();
    const cupos = Number.parseInt(cuposRaw, 10);
    if (!name) {
      failed.push({ line, reason: 'Nombre vacío.' });
      continue;
    }
    if (!Number.isFinite(cupos) || cupos < 1 || cupos > 99) {
      failed.push({ line, reason: 'Cupos inválidos.' });
      continue;
    }
    const token = await generateUniqueToken();
    const inv = await prisma.invitation.create({
      data: { token, guestName: name, cupos },
    });
    created.push({ token: inv.token, guestName: inv.guestName, cupos: inv.cupos });
  }

  revalidatePath('/admin');
  return { ok: true, data: { created, failed } };
}

// --- Gifts --------------------------------------------------------------------

export async function upsertGift(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = upsertGiftSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  const { id, ...data } = parsed;
  const gift = id
    ? await prisma.gift.update({ where: { id }, data })
    : await prisma.gift.create({ data });
  revalidatePath('/admin/regalos');
  revalidatePath('/', 'layout'); // guest view also renders gifts
  return { ok: true, data: { id: gift.id } };
}

export async function deleteGift(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = deleteGiftSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  await prisma.gift.delete({ where: { id: parsed.id } });
  revalidatePath('/admin/regalos');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function reorderGifts(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = reorderGiftsSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  // Update order in a transaction so the swap is atomic.
  await prisma.$transaction(
    parsed.ids.map((id, idx) =>
      prisma.gift.update({ where: { id }, data: { order: idx } }),
    ),
  );
  revalidatePath('/admin/regalos');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function manualReserveGift(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = manualReserveGiftSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  if (parsed.invitationId === null) {
    // Force release.
    await prisma.gift.update({
      where: { id: parsed.giftId },
      data: { reservedById: null, reservedAt: null },
    });
  } else {
    // Atomic claim; if someone else holds it, fail.
    const result = await prisma.gift.updateMany({
      where: { id: parsed.giftId, reservedById: null },
      data: { reservedById: parsed.invitationId, reservedAt: new Date() },
    });
    if (result.count === 0) return fail('Ese regalo ya está apartado por otro invitado.');
  }
  revalidatePath('/admin/regalos');
  revalidatePath('/', 'layout');
  return { ok: true };
}

// --- Menu ---------------------------------------------------------------------

export async function upsertMenuItem(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = upsertMenuItemSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  const { id, ...data } = parsed;
  const item = id
    ? await prisma.menuItem.update({ where: { id }, data })
    : await prisma.menuItem.create({ data });
  revalidatePath('/admin/menu');
  revalidatePath('/', 'layout');
  return { ok: true, data: { id: item.id } };
}

export async function deleteMenuItem(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = deleteMenuItemSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  // Set FKs on Attendee to null before deleting to avoid constraint errors.
  await prisma.$transaction(async (tx) => {
    await tx.attendee.updateMany({
      where: { OR: [{ mainDishId: parsed.id }, { drinkId: parsed.id }] },
      data: { mainDishId: null, drinkId: null },
    });
    await tx.menuItem.delete({ where: { id: parsed.id } });
  });
  revalidatePath('/admin/menu');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function reorderMenu(rawInput: unknown): Promise<AdminActionResult> {
  if (!ensureAdmin()) return fail('No autorizado.');
  let parsed;
  try {
    parsed = reorderMenuSchema.parse(rawInput);
  } catch {
    return fail('Datos inválidos.');
  }
  await prisma.$transaction(
    parsed.ids.map((id, idx) =>
      prisma.menuItem.update({ where: { id }, data: { order: idx } }),
    ),
  );
  revalidatePath('/admin/menu');
  revalidatePath('/', 'layout');
  return { ok: true };
}

// --- Auth ---------------------------------------------------------------------

export async function adminLogin(rawInput: unknown): Promise<AdminActionResult> {
  const { buildAdminCookie, checkAdminPassword } = await import('@/lib/auth');
  const parsed = (rawInput as { password?: unknown })?.password;
  if (typeof parsed !== 'string') return fail('Contraseña requerida.');
  if (!checkAdminPassword(parsed)) return fail('Contraseña incorrecta.');
  const c = buildAdminCookie();
  cookies().set(c.name, c.value, c.options);
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  const { clearAdminCookie } = await import('@/lib/auth');
  const c = clearAdminCookie();
  cookies().set(c.name, c.value, c.options);
  redirect('/admin/login');
}

// -----------------------------------------------------------------------------
// Image scraper
// -----------------------------------------------------------------------------

// Fetches a product page (Amazon, MercadoLibre, any site with og:image) and
// returns the hero image URL. Works without any extra dependency.
//
// Strategy: parse the HTML with regexes for og:image, twitter:image, and
// image_src, in that order. Resolve relative URLs against the source.
//
// Safety: blocks non-http(s), localhost, and RFC1918 / link-local addresses
// to prevent the server from being used as an open proxy (SSRF).

const FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 2_000_000;

function isSafeHttpUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL inválida.' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, reason: 'Solo se permiten URLs http(s).' };
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  ) {
    return { ok: false, reason: 'URL no permitida.' };
  }
  return { ok: true, url };
}

function extractMetaContent(html: string, attr: string, value: string): string | null {
  // Handles both attribute orders and single/double quotes.
  const patterns = [
    new RegExp(
      `<meta[^>]*\\b${attr}=["']${value}["'][^>]*\\bcontent=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]*\\bcontent=["']([^"']+)["'][^>]*\\b${attr}=["']${value}["']`,
      'i',
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractLinkRel(html: string, rel: string): string | null {
  const re = new RegExp(`<link[^>]*\\brel=["']${rel}["'][^>]*\\bhref=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

export async function fetchGiftImage(
  rawInput: unknown,
): Promise<AdminActionResult<{ imageUrl: string }>> {
  if (!ensureAdmin()) return fail('No autorizado.');

  const input = (rawInput as { url?: unknown })?.url;
  if (typeof input !== 'string' || !input.trim()) {
    return fail('Pega una URL de producto.');
  }

  const safety = isSafeHttpUrl(input.trim());
  if (!safety.ok) return fail(safety.reason);

  let res: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    res = await fetch(safety.url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // A real browser UA. Some sites (MercadoLibre, Amazon) refuse requests
        // that look like bots/default fetch.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeoutId);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return fail('Tiempo de espera agotado.');
    }
    return fail('No se pudo acceder a la página.');
  }

  if (!res.ok) {
    return fail(`La página devolvió un error (HTTP ${res.status}).`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_HTML_BYTES) {
    return fail('La página es demasiado grande.');
  }

  const html = await res.text();

  // Try og:image first, then twitter:image, then <link rel="image_src">.
  let imageUrl =
    extractMetaContent(html, 'property', 'og:image:secure_url') ||
    extractMetaContent(html, 'property', 'og:image') ||
    extractMetaContent(html, 'name', 'twitter:image') ||
    extractLinkRel(html, 'image_src');

  if (!imageUrl) {
    return fail(
      'No encontré una imagen en esa página. Pega una URL directa de imagen.',
    );
  }

  // Resolve relative URLs against the source.
  try {
    const resolved = new URL(imageUrl, safety.url);
    if (!['http:', 'https:'].includes(resolved.protocol)) {
      return fail('La imagen encontrada no usa http(s).');
    }
    imageUrl = resolved.toString();
  } catch {
    return fail('URL de imagen inválida.');
  }

  return { ok: true, data: { imageUrl } };
}
