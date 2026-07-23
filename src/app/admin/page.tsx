import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import FilterBar from './_components/FilterBar';
import InvitationsList from './_components/InvitationsList';
import CreateInvitationForm from './_components/CreateInvitationForm';
import BulkCreateForm from './_components/BulkCreateForm';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['PENDING', 'CONFIRMED', 'DECLINED']);

type Search = { status?: string; opened?: string };

export default async function InvitadosPage({ searchParams }: { searchParams: Search }) {
  const where: Prisma.InvitationWhereInput = {};

  if (searchParams.status && searchParams.status !== 'all' && VALID_STATUSES.has(searchParams.status)) {
    where.status = searchParams.status as 'PENDING' | 'CONFIRMED' | 'DECLINED';
  }
  if (searchParams.opened === 'never') {
    where.firstOpenedAt = null;
  } else if (searchParams.opened === 'opened') {
    where.firstOpenedAt = { not: null };
  }

  // Fetch invitations + an unfiltered stats snapshot in parallel.
  const [invitations, allInvitations] = await Promise.all([
    prisma.invitation.findMany({
      where,
      include: {
        attendees: { include: { mainDish: true, drink: true } },
        gifts: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.invitation.findMany({
      select: { status: true, cupos: true, firstOpenedAt: true, attending: true },
    }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  // Compute stats from the unfiltered list.
  const stats = computeStats(allInvitations);

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-terracotta">Invitados</p>
          <h1 className="display-xl text-3xl sm:text-4xl md:text-5xl mt-1 truncate">
            {stats.total} <span className="text-ink-muted">{stats.total === 1 ? 'invitación' : 'invitaciones'}</span>
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <BulkCreateForm />
          <CreateInvitationForm />
        </div>
      </header>

      <StatsRow stats={stats} />

      <FilterBar current={{ status: searchParams.status ?? 'all', opened: searchParams.opened ?? 'all' }} />

      <InvitationsList invitations={invitations} baseUrl={baseUrl} />
    </div>
  );
}

function computeStats(invs: { status: string; cupos: number; firstOpenedAt: Date | null; attending: number | null }[]) {
  const total = invs.length;
  const confirmed = invs.filter((i) => i.status === 'CONFIRMED').length;
  const declined = invs.filter((i) => i.status === 'DECLINED').length;
  const pending = invs.filter((i) => i.status === 'PENDING').length;
  const opened = invs.filter((i) => i.firstOpenedAt != null).length;
  const neverOpened = total - opened;
  const confirmedPeople = invs
    .filter((i) => i.status === 'CONFIRMED')
    .reduce((acc, i) => acc + (i.attending ?? 0), 0);
  const totalCupos = invs.reduce((acc, i) => acc + i.cupos, 0);
  return { total, confirmed, declined, pending, opened, neverOpened, confirmedPeople, totalCupos };
}

function StatsRow({
  stats,
}: {
  stats: {
    total: number;
    confirmed: number;
    declined: number;
    pending: number;
    opened: number;
    neverOpened: number;
    confirmedPeople: number;
    totalCupos: number;
  };
}) {
  const items: { label: string; value: number; sub?: string; accent?: boolean }[] = [
    { label: 'Confirmados', value: stats.confirmed, sub: `${stats.confirmedPeople} personas`, accent: true },
    { label: 'Pendientes', value: stats.pending, sub: `${stats.neverOpened} sin abrir` },
    { label: 'Declinaron', value: stats.declined },
    { label: 'Cupos totales', value: stats.totalCupos, sub: `${stats.total} invitaciones` },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className={[
            'rounded-2xl p-4 sm:p-5 shadow-soft transition-shadow hover:shadow-lift min-w-0',
            it.accent ? 'bg-terracotta text-white' : 'bg-white',
          ].join(' ')}
        >
          <div className={['text-[0.6rem] sm:text-[0.65rem] tracking-[0.2em] sm:tracking-[0.25em] uppercase font-medium leading-tight', it.accent ? 'opacity-80' : 'text-ink-muted'].join(' ')}>
            {it.label}
          </div>
          <div className="display-xl text-3xl sm:text-4xl mt-1 truncate">{it.value}</div>
          {it.sub && (
            <div className={['text-[0.7rem] sm:text-xs mt-1 truncate', it.accent ? 'opacity-80' : 'text-ink-muted'].join(' ')}>
              {it.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
