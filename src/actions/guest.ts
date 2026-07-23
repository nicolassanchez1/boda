'use server';

// Guest-facing server actions. Every mutation:
//   1. Validates input with Zod (never trust the client cap on cupos).
//   2. Re-checks the RSVP deadline server-side.
//   3. Returns a discriminated { ok, code? } so the client can show the right copy.
//   4. Calls revalidatePath so the page re-fetches fresh data.

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { isPastDeadline } from '@/lib/rsvp';
import {
  confirmRsvpSchema,
  releaseGiftSchema,
  reserveGiftSchema,
  type ConfirmRsvpInput,
} from '@/lib/validation';

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; code: 'NOT_FOUND' | 'OVER_CAP' | 'COUNT_MISMATCH' | 'CONFLICT' | 'DEADLINE_PASSED' | 'INVALID' | 'ERROR' };

function deadlinePassed(): boolean {
  return isPastDeadline(process.env.RSVP_DEADLINE);
}

export async function confirmRsvp(rawInput: unknown): Promise<ActionResult> {
  let input: ConfirmRsvpInput;
  try {
    input = confirmRsvpSchema.parse(rawInput);
  } catch {
    return { ok: false, code: 'INVALID' };
  }

  const inv = await prisma.invitation.findUnique({
    where: { token: input.token },
    select: { id: true, cupos: true },
  });
  if (!inv) return { ok: false, code: 'NOT_FOUND' };
  if (deadlinePassed()) return { ok: false, code: 'DEADLINE_PASSED' };

  // Server-side cap enforcement — the UI caps too, but this is the real guardrail.
  if (input.attending > inv.cupos) return { ok: false, code: 'OVER_CAP' };
  if (input.status === 'CONFIRMED' && input.attending < 1) {
    return { ok: false, code: 'COUNT_MISMATCH' };
  }
  if (input.attending !== input.attendees.length) {
    return { ok: false, code: 'COUNT_MISMATCH' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.attendee.deleteMany({ where: { invitationId: inv.id } });

      if (input.attending > 0) {
        await tx.attendee.createMany({
          data: input.attendees.map((a) => ({
            invitationId: inv.id,
            name: a.name,
            mainDishId: a.mainDishId || null,
            drinkId: a.drinkId || null,
            dietaryNotes: a.dietaryNotes || null,
          })),
        });
      }

      await tx.invitation.update({
        where: { id: inv.id },
        data: {
          status: input.status,
          attending: input.attending,
          respondedAt: new Date(),
        },
      });
    });
  } catch {
    return { ok: false, code: 'ERROR' };
  }

  revalidatePath(`/i/${input.token}`);
  return { ok: true };
}

export async function reserveGift(rawInput: unknown): Promise<ActionResult> {
  let input: { token: string; giftId: string };
  try {
    input = reserveGiftSchema.parse(rawInput);
  } catch {
    return { ok: false, code: 'INVALID' };
  }

  const inv = await prisma.invitation.findUnique({
    where: { token: input.token },
    select: { id: true },
  });
  if (!inv) return { ok: false, code: 'NOT_FOUND' };
  if (deadlinePassed()) return { ok: false, code: 'DEADLINE_PASSED' };

  // Atomic compare-and-set: only succeeds if the gift is currently free.
  const result = await prisma.gift.updateMany({
    where: { id: input.giftId, active: true, reservedById: null },
    data: { reservedById: inv.id, reservedAt: new Date() },
  });

  if (result.count === 0) {
    revalidatePath(`/i/${input.token}`);
    return { ok: false, code: 'CONFLICT' };
  }

  revalidatePath(`/i/${input.token}`);
  return { ok: true };
}

export async function releaseGift(rawInput: unknown): Promise<ActionResult> {
  let input: { token: string; giftId: string };
  try {
    input = releaseGiftSchema.parse(rawInput);
  } catch {
    return { ok: false, code: 'INVALID' };
  }

  const inv = await prisma.invitation.findUnique({
    where: { token: input.token },
    select: { id: true },
  });
  if (!inv) return { ok: false, code: 'NOT_FOUND' };
  if (deadlinePassed()) return { ok: false, code: 'DEADLINE_PASSED' };

  // Only the holder can release — atomic compare-and-set on owner.
  const result = await prisma.gift.updateMany({
    where: { id: input.giftId, reservedById: inv.id },
    data: { reservedById: null, reservedAt: null },
  });

  if (result.count === 0) return { ok: false, code: 'CONFLICT' };

  revalidatePath(`/i/${input.token}`);
  return { ok: true };
}
