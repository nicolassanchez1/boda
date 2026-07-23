import { prisma } from '@/lib/prisma';
import { AddButton, List } from './_components/GiftManager';

export const dynamic = 'force-dynamic';

export default async function RegalosPage() {
  const [gifts, invitations] = await Promise.all([
    prisma.gift.findMany({
      include: { reservedBy: { select: { id: true, guestName: true, token: true } } },
      orderBy: { order: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { status: { not: 'PENDING' } },
      select: { id: true, guestName: true, token: true },
      orderBy: { guestName: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-xl text-3xl">Regalos</h1>
          <p className="text-ink-muted text-sm mt-1">
            {gifts.length} {gifts.length === 1 ? 'regalo' : 'regalos'} en la lista.
          </p>
        </div>
        <AddButton />
      </header>

      <List gifts={gifts} invitations={invitations} />
    </div>
  );
}
