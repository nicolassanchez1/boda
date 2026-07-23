import { prisma } from '@/lib/prisma';
import CateringShareButton from './_components/CateringShareButton';

export const revalidate = 30;

export default async function ResumenPage() {
  const [invitations, mainDishes, drinks, attendees, reservedGifts, totalGifts] = await Promise.all([
    prisma.invitation.findMany({
      select: { status: true, cupos: true, firstOpenedAt: true, attending: true },
    }),
    prisma.menuItem.findMany({
      where: { type: 'MAIN_DISH', active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.menuItem.findMany({
      where: { type: 'DRINK', active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.attendee.findMany({
      include: { invitation: { select: { guestName: true } } },
    }),
    prisma.gift.findMany({
      where: { reservedById: { not: null } },
      include: { reservedBy: { select: { guestName: true } } },
      orderBy: { order: 'asc' },
    }),
    prisma.gift.count(),
  ]);

  const totalInvitations = invitations.length;
  const totalCupos = invitations.reduce((acc, i) => acc + i.cupos, 0);
  const confirmedCount = invitations.filter((i) => i.status === 'CONFIRMED').length;
  const declinedCount = invitations.filter((i) => i.status === 'DECLINED').length;
  const pendingCount = invitations.filter((i) => i.status === 'PENDING').length;
  const openedCount = invitations.filter((i) => i.firstOpenedAt != null).length;
  const confirmedPeople = invitations
    .filter((i) => i.status === 'CONFIRMED')
    .reduce((acc, i) => acc + (i.attending ?? 0), 0);
  const responseRate = totalInvitations
    ? Math.round(((confirmedCount + declinedCount) / totalInvitations) * 100)
    : 0;

  // Per-dish and per-drink counts (key for catering).
  const dishCounts = new Map<string | null, number>();
  const drinkCounts = new Map<string | null, number>();
  const dietaryNotes: { guest: string; name: string; notes: string }[] = [];

  for (const a of attendees) {
    dishCounts.set(a.mainDishId, (dishCounts.get(a.mainDishId) ?? 0) + 1);
    drinkCounts.set(a.drinkId, (drinkCounts.get(a.drinkId) ?? 0) + 1);
    if (a.dietaryNotes && a.dietaryNotes.trim()) {
      dietaryNotes.push({ guest: a.invitation.guestName, name: a.name, notes: a.dietaryNotes });
    }
  }

  const dishItems = mainDishes.map((d) => ({ id: d.id, name: d.name, count: dishCounts.get(d.id) ?? 0 }));
  const drinkItems = drinks.map((d) => ({ id: d.id, name: d.name, count: drinkCounts.get(d.id) ?? 0 }));
  const unassignedDish = dishCounts.get(null) ?? 0;
  const unassignedDrink = drinkCounts.get(null) ?? 0;
  const availableGifts = totalGifts - reservedGifts.length;

  // Most popular dish/drink for the hero highlight.
  const topDish = dishItems.slice().sort((a, b) => b.count - a.count)[0];
  const topDrink = drinkItems.slice().sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-terracotta">Resumen</p>
          <h1 className="display-xl text-4xl md:text-5xl mt-1">
            Lo que necesita el catering.
          </h1>
        </div>
        <CateringShareButton
          dishes={dishItems}
          drinks={drinkItems}
          unassignedDish={unassignedDish}
          unassignedDrink={unassignedDrink}
          dietaryNotes={dietaryNotes}
          confirmedPeople={confirmedPeople}
        />
      </header>

      {/* Hero stats — the at-a-glance view */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Confirmados" value={confirmedCount} sub={`${confirmedPeople} ${confirmedPeople === 1 ? 'persona' : 'personas'}`} accent />
        <Stat label="Tasa de respuesta" value={`${responseRate}%`} sub={`${openedCount} de ${totalInvitations} abrieron el enlace`} />
        <Stat label="Pendientes" value={pendingCount} sub={pendingCount > 0 ? 'por confirmar' : 'todos respondieron'} muted={pendingCount === 0} />
        <Stat label="Declinaron" value={declinedCount} muted={declinedCount === 0} />
      </section>

      {/* Catering section — the critical part */}
      <section className="space-y-6">
        <SectionHeading
          eyebrow="Para el catering"
          title="Platos y bebidas"
          subtitle="Lo que cada invitado confirmó que va a consumir."
        />

        <div className="grid lg:grid-cols-2 gap-6">
          <CateringCard
            title="Platos principales"
            total={confirmedPeople}
            items={dishItems}
            unassigned={unassignedDish}
            topName={topDish?.count ? topDish.name : null}
          />
          <CateringCard
            title="Bebidas"
            total={confirmedPeople}
            items={drinkItems}
            unassigned={unassignedDrink}
            topName={topDrink?.count ? topDrink.name : null}
          />
        </div>

        {(unassignedDish > 0 || unassignedDrink > 0) && (
          <div className="bg-ivory-100/60 border border-gold/30 rounded-2xl px-5 py-4 flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-terracotta-dark shrink-0 mt-0.5" aria-hidden>
              <path d="M12 9 L12 13" /><path d="M12 17 L12 17.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <p className="text-sm text-ink-soft">
              {unassignedDish > 0 && (
                <>
                  <strong className="text-ink">{unassignedDish} {unassignedDish === 1 ? 'persona' : 'personas'}</strong>
                  {' '}aún no eligieron plato.
                </>
              )}
              {unassignedDish > 0 && unassignedDrink > 0 && ' · '}
              {unassignedDrink > 0 && (
                <>
                  <strong className="text-ink">{unassignedDrink} {unassignedDrink === 1 ? 'persona' : 'personas'}</strong>
                  {' '}aún no eligieron bebida.
                </>
              )}
              {' '}Pídeles que confirmen antes del evento.
            </p>
          </div>
        )}
      </section>

      {/* Dietary notes — safety critical */}
      <section className="space-y-6">
        <SectionHeading
          eyebrow="Importante"
          title="Notas dietéticas"
          subtitle="Confirma con cada persona antes del evento."
        />

        {dietaryNotes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft p-12 text-center">
            <p className="font-display text-xl text-ink">Nadie dejó notas</p>
            <p className="text-sm text-ink-muted mt-1">Cuando alguien mencione alergias o preferencias aparecerán aquí.</p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {dietaryNotes.map((n, i) => (
              <li
                key={i}
                className="relative bg-white border-l-4 border-terracotta rounded-2xl shadow-soft p-4 pl-5"
              >
                <p className="font-medium text-ink">{n.name}</p>
                <p className="text-xs text-ink-muted mb-2">de {n.guest}</p>
                <p className="text-sm text-ink-soft italic leading-relaxed">
                  "{n.notes}"
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Gifts */}
      <section className="space-y-6">
        <SectionHeading
          eyebrow="Regalos"
          title="Lista de regalos"
          subtitle={`${reservedGifts.length} de ${totalGifts} apartados.`}
        />

        <div className="bg-white rounded-2xl shadow-soft p-6">
          {/* Reserved vs available bar */}
          <GiftStatusBar reserved={reservedGifts.length} available={availableGifts} total={totalGifts} />

          {reservedGifts.length > 0 ? (
            <ul className="mt-6 divide-y divide-ink/5">
              {reservedGifts.map((g) => (
                <li key={g.id} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-sm text-ink-muted truncate">
                    {g.reservedBy?.guestName ?? '—'}
                    {g.reservedAt && (
                      <span className="ml-2 text-xs">
                        · {new Date(g.reservedAt).toLocaleDateString('es-CO')}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-ink-muted text-center">Nadie ha apartado regalos todavía.</p>
          )}
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Stat({
  label,
  value,
  sub,
  accent,
  muted,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-2xl p-5 shadow-soft transition-shadow hover:shadow-lift',
        accent
          ? 'bg-terracotta text-white'
          : muted
          ? 'bg-white opacity-60'
          : 'bg-white',
      ].join(' ')}
    >
      <div
        className={[
          'text-[0.65rem] tracking-[0.25em] uppercase font-medium',
          accent ? 'opacity-80' : 'text-ink-muted',
        ].join(' ')}
      >
        {label}
      </div>
      <div className="display-xl text-4xl mt-1">{value}</div>
      {sub && (
        <div
          className={['text-xs mt-1', accent ? 'opacity-80' : 'text-ink-muted'].join(' ')}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header>
      <p className="eyebrow text-terracotta">{eyebrow}</p>
      <h2 className="display-xl text-3xl mt-1">{title}</h2>
      <p className="text-ink-muted text-sm mt-1">{subtitle}</p>
    </header>
  );
}

function CateringCard({
  title,
  total,
  items,
  unassigned,
  topName,
}: {
  title: string;
  total: number;
  items: { id: string; name: string; count: number }[];
  unassigned: number;
  topName: string | null;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const sorted = items.slice().sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 flex flex-col">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="display-xl text-2xl">{title}</h3>
        <span className="text-xs text-ink-muted">{total} personas</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-muted italic">
          Aún no agregaste opciones. Ve a la pestaña <strong>Menú</strong>.
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-ink-muted italic">
          Nadie ha confirmado aún.
        </p>
      ) : (
        <ul className="space-y-3 flex-1">
          {sorted.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const isTop = topName === item.name;
            return (
              <li key={item.id} className={isTop ? '' : ''}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className={isTop ? 'font-medium text-ink' : 'text-ink-soft'}>
                    {item.name}
                    {isTop && item.count > 0 && (
                      <span className="ml-2 text-[0.6rem] tracking-widest uppercase text-terracotta">
                        más pedido
                      </span>
                    )}
                  </span>
                  <span className={['tabular-nums', isTop ? 'font-semibold text-ink' : 'text-ink-soft'].join(' ')}>
                    {item.count}
                    <span className="text-ink-muted text-xs ml-1">· {pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-ivory-100 rounded-full overflow-hidden">
                  <div
                    className={[
                      'h-full rounded-full transition-all duration-500',
                      isTop ? 'bg-terracotta' : 'bg-ink/30',
                    ].join(' ')}
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {unassigned > 0 && (
        <p className="text-xs text-ink-muted mt-4 pt-4 border-t border-ink/5">
          <strong className="text-terracotta-dark">{unassigned}</strong> {unassigned === 1 ? 'persona sin elegir' : 'personas sin elegir'}
        </p>
      )}
    </div>
  );
}

function GiftStatusBar({
  reserved,
  available,
  total,
}: {
  reserved: number;
  available: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((reserved / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="display-xl text-3xl tabular-nums">
          {reserved}
          <span className="text-ink-muted text-2xl">/{total}</span>
        </span>
        <span className="text-xs text-ink-muted">{pct}% apartados</span>
      </div>
      <div className="h-2 bg-ivory-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-ink-muted mt-2">
        <span>{available} disponibles</span>
        <span>{reserved} apartados</span>
      </div>
    </div>
  );
}
