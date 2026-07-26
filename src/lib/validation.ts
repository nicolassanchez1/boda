// Zod schemas for every mutation. Server actions MUST validate input before
// touching the DB — never trust the client cap on cupos or anything else.

import { z } from 'zod';

const trimmedNonEmpty = z.string().trim().min(1).max(200);

// --- Guest mutations ---------------------------------------------------------

export const confirmRsvpSchema = z
  .object({
    token: trimmedNonEmpty,
    status: z.enum(['CONFIRMED', 'DECLINED']),
    attending: z.number().int().min(0).max(99),
    attendees: z
      .array(
        z.object({
          id: z.string().optional(), // existing attendee id (when editing)
          name: trimmedNonEmpty,
          mainDishId: z.string().nullable().optional(),
          drinkId: z.string().nullable().optional(),
          dietaryNotes: z.string().trim().max(500).nullable().optional(),
        }),
      )
      .max(99),
  })
  .refine(
    (v) => (v.status === 'CONFIRMED' ? v.attending >= 1 : v.attending === 0),
    { message: 'Si confirmas asistencia, debe haber al menos 1 persona.', path: ['attending'] },
  )
  .refine(
    (v) => (v.status === 'CONFIRMED' ? v.attending === v.attendees.length : true),
    { message: 'El número de asistentes debe coincidir con los datos que llenaste.', path: ['attendees'] },
  );

export const reserveGiftSchema = z.object({
  token: trimmedNonEmpty,
  giftId: trimmedNonEmpty,
});

export const releaseGiftSchema = z.object({
  token: trimmedNonEmpty,
  giftId: trimmedNonEmpty,
});

// --- Admin mutations ---------------------------------------------------------

export const createInvitationSchema = z.object({
  guestName: trimmedNonEmpty,
  cupos: z.coerce.number().int().min(1).max(99),
  phone: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .transform((v) => (v ? v.replace(/\s+/g, '') : null)),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const updateInvitationSchema = z.object({
  id: trimmedNonEmpty,
  guestName: trimmedNonEmpty,
  cupos: z.coerce.number().int().min(1).max(99),
  phone: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .transform((v) => (v ? v.replace(/\s+/g, '') : null)),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const deleteInvitationSchema = z.object({ id: trimmedNonEmpty });

export const bulkCreateSchema = z.object({
  // Each line is "<name>, <cupos>" — we parse this on the server, not the client.
  lines: z.string().trim().min(1).max(50_000),
});

// URL helper: we don't use Zod's .url() because Amazon CDN URLs contain
// characters that fail the standard URL validator (e.g. `+`, long query
// strings, sometimes URL-encoded fragments). We use a custom regex that
// just checks the shape (protocol + host) and length.
const safeUrl = z
  .string()
  .trim()
  .max(2000, 'La URL es demasiado larga (máx 2000 caracteres).')
  .refine(
    (v) => {
      if (!v) return true; // empty string → null below
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL inválida (debe empezar con http:// o https://).' },
  );

export const upsertGiftSchema = z.object({
  id: z.string().nullable().optional(),
  name: trimmedNonEmpty,
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: safeUrl.nullable().optional().or(z.literal('').transform(() => null)),
  storeUrl: safeUrl.nullable().optional().or(z.literal('').transform(() => null)),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.coerce.boolean().default(true),
});

export const deleteGiftSchema = z.object({ id: trimmedNonEmpty });
export const reorderGiftsSchema = z.object({ ids: z.array(trimmedNonEmpty).min(1).max(500) });

export const manualReserveGiftSchema = z.object({
  giftId: trimmedNonEmpty,
  invitationId: trimmedNonEmpty.nullable(),
});

export const upsertMenuItemSchema = z.object({
  id: z.string().nullable().optional(),
  type: z.enum(['MAIN_DISH', 'SIDE', 'DRINK']),
  name: trimmedNonEmpty,
  description: z.string().trim().max(500).nullable().optional(),
  // Menu photos are usually a local path (/menu/….jpg) but an external image
  // URL is fine too. Admin-only input, so a lenient string (not the SSRF-safe
  // fetch validator the gifts use) is enough — we only render it in an <img>.
  imageUrl: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.coerce.boolean().default(true),
});

export const deleteMenuItemSchema = z.object({ id: trimmedNonEmpty });
export const reorderMenuSchema = z.object({
  type: z.enum(['MAIN_DISH', 'SIDE', 'DRINK']),
  ids: z.array(trimmedNonEmpty).min(1).max(500),
});

// --- Inferred types ---------------------------------------------------------

export type ConfirmRsvpInput = z.infer<typeof confirmRsvpSchema>;
export type UpsertGiftInput = z.infer<typeof upsertGiftSchema>;
export type UpsertMenuItemInput = z.infer<typeof upsertMenuItemSchema>;
