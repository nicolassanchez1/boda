import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DiamondRule } from '@/components/ui/Ornament';
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
  const isFiltered: boolean = Boolean(
    (searchParams.status && searchParams.status !== 'all') ||
      (searchParams.opened && searchParams.opened !== 'all'),
  );

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero header — sets the editorial tone for the page. */}
      <header className="relative">
        {/* Editorial gold rule with diamond ornament */}
        <DiamondRule className="mb-5 sm:mb-6 text-gold" />

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-terracotta">Invitados</p>
            <h1 className="display-xl text-3xl sm:text-4xl md:text-5xl mt-2">
              <span>{stats.total}</span>{' '}
              <span className="text-ink-muted">
                {stats.total === 1 ? 'invitación' : 'invitaciones'}
              </span>
            </h1>
            {/* Quick pulse — desktop only. On mobile the stats row below
                carries the same info, and /admin/resumen has the full
                breakdown, so we skip it here to reduce vertical noise. */}
            <p className="hidden sm:block mt-3 text-sm text-ink-soft leading-relaxed">
              {stats.confirmed > 0 && (
                <>
                  <strong className="text-sage-dark font-medium">
                    {stats.confirmed} {stats.confirmed === 1 ? 'confirmada' : 'confirmadas'}
                  </strong>
                  {stats.confirmedPeople > 0 && (
                    <span className="text-ink-muted">
                      {' '}
                      · {stats.confirmedPeople} {stats.confirmedPeople === 1 ? 'persona' : 'personas'}
                    </span>
                  )}
                  {(stats.pending > 0 || stats.declined > 0) && <span className="text-ink-muted/50">  ·  </span>}
                </>
              )}
              {stats.pending > 0 && (
                <>
                  <strong className="text-terracotta-dark font-medium">
                    {stats.pending} {stats.pending === 1 ? 'pendiente' : 'pendientes'}
                  </strong>
                  {stats.neverOpened > 0 && (
                    <span className="text-ink-muted">
                      {' '}
                      ({stats.neverOpened} sin abrir)
                    </span>
                  )}
                  {stats.declined > 0 && <span className="text-ink-muted/50">  ·  </span>}
                </>
              )}
              {stats.declined > 0 && (
                <span className="text-ink-muted">
                  <strong className="text-ink-soft font-medium">
                    {stats.declined} {stats.declined === 1 ? 'declinó' : 'declinaron'}
                  </strong>
                </span>
              )}
              {stats.total === 0 && (
                <span className="text-ink-muted">
                  Creá la primera invitación con el botón de la derecha.
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <BulkCreateForm />
            <CreateInvitationForm />
          </div>
        </div>
      </header>

      {/* Stats row — full-width cards on mobile, 4-up on desktop. */}
      <section aria-label="Resumen de invitaciones">
        <StatsRow stats={stats} />
      </section>

      {/* Filters section — wrapped in a card so it reads as a distinct unit. */}
      <section className="bg-white rounded-2xl shadow-soft p-5 sm:p-5">
        <header className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-baseline gap-2">
            <p className="smallcaps text-ink-muted">Filtrar</p>
            {isFiltered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta-dark text-[0.65rem] font-semibold tracking-wider uppercase">
                Activo
              </span>
            )}
          </div>
          {isFiltered && (
            <a
              href="/admin"
              className="cursor-pointer text-xs text-terracotta-dark hover:text-terracotta transition-colors inline-flex items-center gap-1.5 font-medium"
            >
              <span>Limpiar</span>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="w-3 h-3"
                aria-hidden
              >
                <path d="M4 4 L12 12 M12 4 L4 12" />
              </svg>
            </a>
          )}
        </header>
        <FilterBar
          current={{
            status: searchParams.status ?? 'all',
            opened: searchParams.opened ?? 'all',
          }}
        />
      </section>

      {/* Invitations list */}
      <section>
        <InvitationsList
          invitations={invitations}
          baseUrl={baseUrl}
          isFiltered={isFiltered}
          totalCount={stats.total}
        />
      </section>
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
  // Each item gets a colored left rail + icon for scannability on mobile.
  const items: {
    label: string;
    value: number;
    sub?: string;
    accent: 'sage' | 'terracotta' | 'gold' | 'ink';
    icon: React.ReactNode;
  }[] = [
    {
      label: 'Confirmados',
      value: stats.confirmed,
      sub: `${stats.confirmedPeople} ${stats.confirmedPeople === 1 ? 'persona' : 'personas'}`,
      accent: 'sage',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12 L10 17 L19 7" />
        </svg>
      ),
    },
    {
      label: 'Pendientes',
      value: stats.pending,
      sub: `${stats.neverOpened} sin abrir`,
      accent: 'terracotta',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7 L12 13 M12 16 L12 17" />
        </svg>
      ),
    },
    {
      label: 'Declinaron',
      value: stats.declined,
      accent: 'ink',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9 L15 15 M15 9 L9 15" />
        </svg>
      ),
    },
    {
      label: 'Cupos totales',
      value: stats.totalCupos,
      sub: `${stats.total} invitaciones`,
      accent: 'gold',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20 v-1 a4 4 0 0 1 4 -4 h4 a4 4 0 0 1 4 4 v1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="group relative bg-white rounded-2xl shadow-soft hover:shadow-lift transition-shadow overflow-hidden min-w-0"
        >
          {/* Color rail — left vertical accent for scannability. */}
          <div
            className={[
              'absolute left-0 top-0 bottom-0 w-1',
              it.accent === 'sage' && 'bg-sage',
              it.accent === 'terracotta' && 'bg-terracotta',
              it.accent === 'gold' && 'bg-gold',
              it.accent === 'ink' && 'bg-ink/30',
            ]
              .filter(Boolean)
              .join(' ')}
          />

          <div className="p-5 sm:p-5 pl-5 sm:pl-6 flex items-start gap-3">
            {/* Icon chip */}
            <div
              className={[
                'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                it.accent === 'sage' && 'bg-sage/15 text-sage-dark',
                it.accent === 'terracotta' && 'bg-terracotta/10 text-terracotta-dark',
                it.accent === 'gold' && 'bg-gold/15 text-gold',
                it.accent === 'ink' && 'bg-ink/10 text-ink-muted',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="w-5 h-5 block">{it.icon}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[0.65rem] sm:text-[0.7rem] tracking-[0.18em] uppercase font-medium text-ink-muted leading-tight">
                {it.label}
              </div>
              <div className="display-xl text-3xl sm:text-4xl mt-1 leading-none truncate">
                {it.value}
              </div>
              {it.sub && (
                <div className="text-[0.7rem] sm:text-xs mt-1.5 text-ink-muted truncate">
                  {it.sub}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
