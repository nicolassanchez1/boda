// Server component — resolves the token, stamps firstOpenedAt once,
// fetches the data the guest needs, then hands off to the client view.

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isPastDeadline } from '@/lib/rsvp';
import GuestView from './GuestView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InvitationPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      attendees: { include: { mainDish: true, drink: true } },
      gifts: { select: { id: true } },
    },
  });

  if (!invitation) notFound();

  // Stamp firstOpenedAt once. Idempotent (we only update when null) so this is
  // safe to run during render. If the write fails we silently move on — the rest
  // of the page still works.
  if (!invitation.firstOpenedAt) {
    prisma.invitation
      .update({
        where: { id: invitation.id, firstOpenedAt: null },
        data: { firstOpenedAt: new Date() },
      })
      .catch(() => {});
  }

  const [mainDishes, drinks, allGifts] = await Promise.all([
    prisma.menuItem.findMany({
      where: { type: 'MAIN_DISH', active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, description: true },
    }),
    prisma.menuItem.findMany({
      where: { type: 'DRINK', active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, description: true },
    }),
    prisma.gift.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        storeUrl: true,
        reservedById: true,
      },
    }),
  ]);

  const isReadOnly = isPastDeadline(process.env.RSVP_DEADLINE);

  return (
    <GuestView
      invitation={{
        token: invitation.token,
        guestName: invitation.guestName,
        cupos: invitation.cupos,
        status: invitation.status,
        attending: invitation.attending,
        attendees: invitation.attendees.map((a) => ({
          id: a.id,
          name: a.name,
          mainDishId: a.mainDishId,
          drinkId: a.drinkId,
          dietaryNotes: a.dietaryNotes,
        })),
        reservedGiftIds: invitation.gifts.map((g) => g.id),
      }}
      menu={{ mainDishes, drinks }}
      gifts={allGifts.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        imageUrl: g.imageUrl,
        storeUrl: g.storeUrl,
        reservedByMe: g.reservedById === invitation.id,
        reservedByOther: g.reservedById !== null && g.reservedById !== invitation.id,
      }))}
      weddingInfo={{
        date: process.env.NEXT_PUBLIC_WEDDING_DATE ?? '',
        time: process.env.NEXT_PUBLIC_WEDDING_TIME ?? '',
        venue: process.env.NEXT_PUBLIC_VENUE ?? '',
      }}
      isReadOnly={isReadOnly}
    />
  );
}
