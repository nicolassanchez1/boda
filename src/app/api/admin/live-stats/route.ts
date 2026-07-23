// Lightweight stats endpoint for the admin live activity widget. Polled by the
// client every 10s via TanStack Query so the admin sees new RSVPs and
// reservations without refreshing.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { ADMIN_COOKIE_NAME, isAdminAuthed } from '@/lib/auth';

// Always fresh — no caching.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (!isAdminAuthed(cookies().get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [
    total,
    confirmed,
    declined,
    pending,
    opened,
    recentRsvps,
    reservedGifts,
    totalGifts,
  ] = await Promise.all([
    prisma.invitation.count(),
    prisma.invitation.count({ where: { status: 'CONFIRMED' } }),
    prisma.invitation.count({ where: { status: 'DECLINED' } }),
    prisma.invitation.count({ where: { status: 'PENDING' } }),
    prisma.invitation.count({ where: { firstOpenedAt: { not: null } } }),
    prisma.invitation.count({ where: { respondedAt: { gte: fiveMinAgo } } }),
    prisma.gift.count({ where: { reservedById: { not: null } } }),
    prisma.gift.count({ where: { active: true } }),
  ]);

  return NextResponse.json({
    total,
    confirmed,
    declined,
    pending,
    opened,
    recentRsvps,
    reservedGifts,
    totalGifts,
    serverTime: new Date().toISOString(),
  });
}
