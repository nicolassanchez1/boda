// Server component — resolves the token, stamps firstOpenedAt once,
// fetches the data the guest needs, then hands off to the client view.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isPastDeadline } from '@/lib/rsvp';
import { extractInvitationToken } from '@/lib/format';
import GuestView from './GuestView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Open Graph / link preview — what WhatsApp shows when the invitation link is
// shared: the plantilla image (as a card) + a warm title/description. Generic on
// purpose (no guest name) so the preview is the same for everyone. The image is
// public (public/plantilla/og.jpg) even though the page itself stays noindex.
export function generateMetadata(): Metadata {
  const couple = process.env.NEXT_PUBLIC_COUPLE_NAME;
  const title = couple ? `${couple} · Nuestra invitación` : 'Nuestra invitación ✨';
  const description =
    'Una comida íntima antes de nuestro gran día. Toca para ver todos los detalles 🌿';
  const image = {
    url: '/plantilla/og.jpg',
    width: 1000,
    height: 2303,
    alt: 'Invitación',
  };
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

// The URL slug is `nombre-del-invitado-TOKEN`; only the token authenticates.
export default async function InvitationPage({ params }: { params: { slug: string } }) {
  const token = extractInvitationToken(params.slug);

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

  const [mainDishes, sides, drinks, allGifts] = await Promise.all([
    prisma.menuItem.findMany({
      where: { type: 'MAIN_DISH', active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, description: true, imageUrl: true },
    }),
    prisma.menuItem.findMany({
      where: { type: 'SIDE', active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, description: true, imageUrl: true },
    }),
    prisma.menuItem.findMany({
      where: { type: 'DRINK', active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, description: true, imageUrl: true },
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
      menu={{ mainDishes, sides, drinks }}
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
        // Exact pin if provided, else a Google Maps search from the venue name.
        mapsUrl:
          process.env.NEXT_PUBLIC_MAPS_URL ??
          (process.env.NEXT_PUBLIC_VENUE
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                process.env.NEXT_PUBLIC_VENUE,
              )}`
            : ''),
      }}
      isReadOnly={isReadOnly}
    />
  );
}
