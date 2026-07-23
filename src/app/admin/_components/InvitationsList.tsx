'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  deleteInvitation,
  updateInvitation,
} from '@/actions/admin';
import {
  rsvpStatusLabel,
} from '@/lib/rsvp';
import { buildInvitationLink, buildWhatsAppUrl } from '@/lib/format';

type InvitationWithRelations = Prisma.InvitationGetPayload<{
  include: {
    attendees: { include: { mainDish: true; drink: true } };
    gifts: { select: { id: true; name: true } };
  };
}>;

type SortKey = 'recent' | 'name' | 'status';
type StatusFilter = 'all' | 'PENDING' | 'CONFIRMED' | 'DECLINED';

export default function InvitationsList({
  invitations,
  baseUrl,
  totalCount,
}: {
  invitations: InvitationWithRelations[];
  baseUrl: string;
  totalCount?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('status');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = invitations;
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (q) {
      list = list.filter(
        (i) =>
          i.guestName.toLowerCase().includes(q) ||
          (i.phone ?? '').includes(q) ||
          (i.notes ?? '').toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === 'name') {
      sorted.sort((a, b) => a.guestName.localeCompare(b.guestName, 'es'));
    } else if (sort === 'status') {
      sorted.sort((a, b) => priority(a) - priority(b));
    } else {
      sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return sorted;
  }, [invitations, search, sort, statusFilter]);

  const isFiltered = statusFilter !== 'all' || search.trim() !== '';

  if (invitations.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-8 sm:p-12 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-ivory-100 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-ink-muted">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <p className="font-display text-2xl text-ink mb-1">Sin invitaciones</p>
        <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto leading-relaxed">
          Creá la primera desde el botón de arriba a la derecha.
        </p>
      </div>
    );
  }

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-3">
      {/* ─── Sticky filters bar ───
          Search + 3 status chips (Aceptadas / Pendientes / Rechazadas) in a
          single sticky container. On mobile the bar sticks to the bottom of
          the admin header so the admin can always reach the search & status
          filters while scrolling long lists. Animates in/out via scroll
          direction so it doesn't get in the way while reading cards. */}
      <StickyFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sort={sort}
        onSortChange={setSort}
        counts={{
          all: invitations.length,
          PENDING: invitations.filter((i) => i.status === 'PENDING').length,
          CONFIRMED: invitations.filter((i) => i.status === 'CONFIRMED').length,
          DECLINED: invitations.filter((i) => i.status === 'DECLINED').length,
        }}
      />

      {/* Count line — shows what's visible. */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-ink-muted">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 text-ink-muted/60"
            aria-hidden
          >
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="11" cy="6.5" r="2" />
            <path d="M2 13 v-0.5 a3 3 0 0 1 3 -3 h2 a3 3 0 0 1 3 3 v0.5" />
            <path d="M10.5 13 v-0.5 a2.5 2.5 0 0 1 1.5 -2.3" />
          </svg>
          <span>
            <strong className="font-medium text-ink-soft">{filtered.length}</strong>{' '}
            {filtered.length === 1 ? 'invitación' : 'invitaciones'}
            {isFiltered && (
              <span className="text-ink-muted">
                {' '}
                de {invitations.length}
              </span>
            )}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="cursor-pointer ml-auto inline-flex items-center gap-1 text-terracotta-dark hover:text-terracotta transition-colors font-medium"
            >
              <span>Limpiar filtros</span>
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
            </button>
          )}
        </div>
      )}

      {/* Card list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft p-8 sm:p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-ivory-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-6 h-6 text-ink-muted" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20 L16 16" />
              </svg>
            </div>
            <p className="font-display text-xl text-ink mb-1">Sin coincidencias</p>
            <p className="text-sm text-ink-muted mb-5">
              Ninguna invitación coincide con los filtros activos.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors text-sm"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          filtered.map((inv) => (
            <InvitationCard
              key={inv.id}
              invitation={inv}
              baseUrl={baseUrl}
              onChanged={() => router.refresh()}
            />
          ))
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sticky filters bar
// -----------------------------------------------------------------------------

const STATUS_CHIPS: { key: StatusFilter; label: string; dot: string }[] = [
  { key: 'all', label: 'Todas', dot: 'bg-ink-muted/40' },
  { key: 'CONFIRMED', label: 'Aceptadas', dot: 'bg-sage' },
  { key: 'PENDING', label: 'Pendientes', dot: 'bg-terracotta' },
  { key: 'DECLINED', label: 'Rechazadas', dot: 'bg-ink-muted' },
];

function StickyFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  counts,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  sort: SortKey;
  onSortChange: (v: SortKey) => void;
  counts: Record<StatusFilter, number>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // Track whether the bar has crossed the top of the viewport — when it
  // starts to stick, we add a stronger shadow + thicker border so the
  // transition from inline → sticky is visually clear.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    sentinel.style.marginTop = '-1px';
    el.parentElement?.insertBefore(sentinel, el);
    const io = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio < 1),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' },
    );
    io.observe(sentinel);
    return () => {
      io.disconnect();
      sentinel.remove();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={[
        // Sticky just below the admin header (~88px on mobile, ~80px on desktop).
        // z-40 keeps it under modals (z-50) but above cards (z-0).
        'sticky top-[5.5rem] sm:top-20 z-40 -mx-4 sm:mx-0 px-4 sm:px-0 py-2',
        // Frosted glass so cards scrolling under it stay legible but subtle.
        'bg-ivory-50/90 sm:bg-ivory-50/85 backdrop-blur-md',
        // Border + shadow appear only when stuck — the visual cue.
        stuck
          ? 'border-b border-ink/10 shadow-soft'
          : 'border-b border-transparent',
        'transition-[border-color,box-shadow] duration-200',
      ].join(' ')}
    >
      <div className="bg-white sm:bg-white rounded-2xl shadow-soft p-3 sm:p-4 space-y-3">
        {/* Row 1 — search input */}
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20 L16 16" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, teléfono o notas…"
            aria-label="Buscar invitados"
            className="w-full pl-10 pr-10 py-2.5 sm:py-2.5 bg-ivory-50 border border-ink/10 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-ink-muted hover:bg-ivory-100 hover:text-ink transition-colors flex items-center justify-center"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3" aria-hidden>
                <path d="M4 4 L12 12 M12 4 L4 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Row 2 — status chips + sort, scroll horizontally on mobile */}
        <div className="flex items-center gap-2 -mx-1 px-1 overflow-x-auto scrollbar-none snap-x snap-mandatory">
          {STATUS_CHIPS.map((chip) => {
            const isActive = statusFilter === chip.key;
            const count = counts[chip.key];
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => onStatusFilterChange(chip.key)}
                aria-pressed={isActive}
                className={[
                  'cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 sm:py-2 rounded-full text-sm font-medium border shrink-0 snap-start transition-all active:scale-[0.97]',
                  isActive
                    ? 'bg-terracotta text-white border-terracotta shadow-soft'
                    : 'bg-white border-ink/20 text-ink-soft hover:text-ink hover:border-ink/40 hover:bg-ivory-100',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    isActive ? 'bg-white/80' : chip.dot,
                  ].join(' ')}
                  aria-hidden
                />
                <span>{chip.label}</span>
                <span
                  className={[
                    'text-[0.65rem] font-semibold tabular-nums px-1.5 rounded-full',
                    isActive ? 'bg-white/20 text-white' : 'bg-ivory-100 text-ink-muted',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Sort select — pushed to the right on desktop */}
          <div className="hidden sm:block ml-auto shrink-0">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              aria-label="Ordenar"
              className="cursor-pointer px-3 py-2 bg-ivory-50 border border-ink/15 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            >
              <option value="status">Prioridad</option>
              <option value="recent">Más recientes</option>
              <option value="name">Nombre A-Z</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Individual invitation card — tap to open the actions sheet
// -----------------------------------------------------------------------------

function InvitationCard({
  invitation,
  baseUrl,
  onChanged,
}: {
  invitation: InvitationWithRelations;
  baseUrl: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const link = buildInvitationLink(baseUrl, invitation.token);
  const whatsappMessage = buildWhatsappMessage(invitation.guestName, link);
  const whatsappUrl = buildWhatsAppUrl(invitation.phone, whatsappMessage);

  // Visual priority:
  //   1. PENDING + never opened → terracotta accent (most urgent)
  //   2. PENDING + opened       → amber
  //   3. CONFIRMED              → subtle (success)
  //   4. DECLINED               → very subtle (muted)
  const accentColor =
    invitation.status === 'PENDING' && !invitation.firstOpenedAt
      ? 'bg-terracotta'
      : invitation.status === 'PENDING'
      ? 'bg-gold'
      : invitation.status === 'CONFIRMED'
      ? 'bg-sage'
      : 'bg-ink/20';

  const attendeeCount = invitation.attendees.length;
  const giftCount = invitation.gifts.length;
  const showAttentionBadge =
    invitation.status === 'PENDING' && !invitation.firstOpenedAt;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      window.prompt('Copia este enlace:', link);
    }
  };

  const openWhatsApp = () => {
    if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const remove = () => {
    setDeleting(false);
    startTransition(async () => {
      const result = await deleteInvitation({ id: invitation.id });
      if (!result.ok) alert(result.error);
      onChanged();
    });
  };

  return (
    <>
      <motion.button
        type="button"
        layout
        transition={{ duration: 0.2 }}
        onClick={() => setSheetOpen(true)}
        aria-label={`Acciones para ${invitation.guestName}`}
        className={[
          'group relative w-full text-left bg-white rounded-2xl shadow-soft overflow-hidden transition-all touch-manipulation cursor-pointer',
          'hover:shadow-lift active:scale-[0.995] focus-visible:ring-2 focus-visible:ring-terracotta/40 focus-visible:outline-none',
          invitation.status === 'DECLINED' ? 'opacity-70' : '',
        ].join(' ')}
      >
        {/* Left accent bar — color rail for status at-a-glance */}
        <div className={['absolute left-0 top-0 bottom-0 w-1.5', accentColor].join(' ')} />

        <div className="pl-6 pr-5 py-4 sm:pl-7 sm:pr-6 sm:py-5">
          {/* ─── Header row: name + status badge in top-right corner ─── */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <h3 className="font-display text-xl sm:text-2xl text-ink leading-tight truncate min-w-0 flex-1">
              {invitation.guestName}
            </h3>
            <div className="shrink-0 pt-0.5">
              <StatusBadge status={invitation.status} />
            </div>
          </div>

          {/* ─── Primary meta row: cupos + opened/attention ─── */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="inline-flex items-center gap-1.5 bg-ivory-100 text-ink px-3 py-1.5 rounded-full text-sm font-semibold">
              <UsersIcon className="w-4 h-4 text-ink-soft" />
              {invitation.attending != null ? `${invitation.attending} / ${invitation.cupos}` : `${invitation.cupos} cupos`}
            </span>
            {invitation.firstOpenedAt ? (
              <span
                className="inline-flex items-center gap-1.5 bg-sage/15 text-sage-dark px-3 py-1.5 rounded-full text-sm font-semibold"
                title={`Abierto el ${new Date(invitation.firstOpenedAt).toLocaleDateString('es-CO')}`}
              >
                <CheckIcon className="w-4 h-4" />
                Abierto
              </span>
            ) : showAttentionBadge ? (
              <span className="inline-flex items-center gap-1.5 bg-terracotta text-white px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide shadow-soft">
                <BellIcon className="w-4 h-4" />
                No abrió
              </span>
            ) : null}
          </div>

          {/* ─── Secondary info: phone + notes ─── */}
          {(invitation.phone || invitation.notes) && (
            <div className="mt-3 space-y-1">
              {invitation.phone && (
                <p className="text-sm text-ink-soft inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-ink-muted" aria-hidden>
                    <path d="M3 3 L6 3 L7.5 6 L6 7.5 C7 9 7.5 9.5 9 10.5 L10.5 9 L13.5 10.5 L13.5 13.5 C9 13.5 2.5 7 2.5 3 Z" />
                  </svg>
                  <span className="font-medium tracking-wide">{invitation.phone}</span>
                </p>
              )}
              {invitation.notes && (
                <p className="text-xs text-ink-muted italic line-clamp-2">
                  "{invitation.notes}"
                </p>
              )}
            </div>
          )}

          {/* ─── Tertiary: attendee + gift counts ─── */}
          {(attendeeCount > 0 || giftCount > 0) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-ink/8 text-xs text-ink-muted">
              {attendeeCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
                    <circle cx="6" cy="6" r="2.5" />
                    <circle cx="11" cy="6.5" r="2" />
                    <path d="M2 13 v-0.5 a3 3 0 0 1 3 -3 h2 a3 3 0 0 1 3 3 v0.5" />
                    <path d="M10.5 13 v-0.5 a2.5 2.5 0 0 1 1.5 -2.3" />
                  </svg>
                  <span><strong className="text-ink-soft font-semibold">{attendeeCount}</strong> {attendeeCount === 1 ? 'asistente' : 'asistentes'}</span>
                </span>
              )}
              {giftCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
                    <path d="M2 6 L14 6 L14 13 L2 13 Z" />
                    <path d="M2 6 L2 4 L14 4 L14 6" />
                    <path d="M8 4 L8 13" />
                  </svg>
                  <span><strong className="text-ink-soft font-semibold">{giftCount}</strong> {giftCount === 1 ? 'regalo' : 'regalos'}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </motion.button>

      {/* ─── Actions sheet (bottom sheet on mobile, side modal on desktop) ───
          Opens on card tap. Mobile-first: full-width bottom sheet with handle,
          big touch targets, danger styling for destructive actions. */}
      <AnimatePresence>
        {sheetOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40"
            onClick={() => setSheetOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`Acciones para ${invitation.guestName}`}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-ivory-50 rounded-t-3xl sm:rounded-3xl shadow-lift overflow-hidden"
            >
              {/* Handle (mobile only — visual affordance for "this is a sheet") */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <span className="w-10 h-1 rounded-full bg-ink/15" />
              </div>

              {/* Header — name + status, so user knows which invitation they're acting on */}
              <header className="px-5 sm:px-7 pt-3 sm:pt-6 pb-4 border-b border-ink/10">
                <p className="smallcaps text-ink-muted">Invitación</p>
                <h3 className="font-display text-2xl text-ink mt-1 truncate">{invitation.guestName}</h3>
                <div className="mt-2">
                  <StatusBadge status={invitation.status} />
                </div>
              </header>

              {/* Actions list */}
              <div className="py-2">
                <SheetItem
                  icon={<CopyIcon className="w-5 h-5" />}
                  onClick={async () => {
                    setSheetOpen(false);
                    await copy();
                  }}
                  trailing={
                    copyState === 'copied' ? (
                      <span className="text-xs text-sage-dark font-semibold uppercase tracking-wider">¡Copiado!</span>
                    ) : null
                  }
                >
                  Copiar enlace
                </SheetItem>

                {whatsappUrl && (
                  <SheetItem
                    icon={<ChatIcon className="w-5 h-5" />}
                    onClick={() => {
                      setSheetOpen(false);
                      openWhatsApp();
                    }}
                  >
                    Enviar WhatsApp
                  </SheetItem>
                )}

                <div className="h-px bg-ink/5 mx-5 my-1" />

                <SheetItem
                  icon={<EditIcon className="w-5 h-5" />}
                  onClick={() => {
                    setSheetOpen(false);
                    setEditing(true);
                  }}
                >
                  Editar invitación
                </SheetItem>

                <div className="h-px bg-ink/5 mx-5 my-1" />

                <SheetItem
                  icon={<TrashIcon className="w-5 h-5" />}
                  onClick={() => {
                    setSheetOpen(false);
                    setDeleting(true);
                  }}
                  danger
                >
                  Eliminar invitación
                </SheetItem>
              </div>

              {/* Cancel footer */}
              <div className="px-5 sm:px-7 pt-2 pb-4 border-t border-ink/10">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="cursor-pointer w-full min-h-[48px] rounded-full bg-white border border-ink/15 text-ink font-medium hover:bg-ivory-100 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && (
          <EditInvitationModal
            invitation={invitation}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleting && (
          <ConfirmModal
            title={`¿Eliminar la invitación de "${invitation.guestName}"?`}
            body="Se eliminarán también sus asistentes y se liberarán los regalos que tengan apartados."
            confirmLabel={pending ? 'Eliminando…' : 'Eliminar'}
            tone="danger"
            onCancel={() => setDeleting(false)}
            onConfirm={remove}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// -----------------------------------------------------------------------------
// Shared atoms
// -----------------------------------------------------------------------------

function StatusBadge({ status }: { status: 'PENDING' | 'CONFIRMED' | 'DECLINED' }) {
  const cls =
    status === 'CONFIRMED'
      ? 'bg-sage/15 text-sage-dark'
      : status === 'DECLINED'
      ? 'bg-ink/10 text-ink-muted'
      : 'bg-terracotta/15 text-terracotta-dark';
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-3 py-1 sm:px-2.5 sm:py-1 rounded-full text-[0.7rem] sm:text-xs font-semibold uppercase tracking-wider',
        cls,
      ].join(' ')}
    >
      <span
        className={[
          'w-1.5 h-1.5 rounded-full',
          status === 'CONFIRMED' && 'bg-sage',
          status === 'PENDING' && 'bg-terracotta',
          status === 'DECLINED' && 'bg-ink-muted',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden
      />
      {rsvpStatusLabel(status)}
    </span>
  );
}

// Bottom-sheet / modal action row. Bigger tap targets than the desktop menu
// (52px vs 36px) because mobile thumbs need more room.
function SheetItem({
  icon,
  children,
  onClick,
  danger,
  trailing,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        'cursor-pointer w-full flex items-center gap-3 px-5 sm:px-7 min-h-[52px] sm:min-h-[44px] text-left transition-colors',
        danger
          ? 'text-terracotta-dark hover:bg-terracotta/10'
          : 'text-ink hover:bg-ivory-100',
      ].join(' ')}
    >
      {icon && (
        <span className={danger ? 'text-terracotta' : 'text-ink-muted'}>{icon}</span>
      )}
      <span className="flex-1 text-base font-medium">{children}</span>
      {trailing}
    </button>
  );
}

function Checkbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  // Tap target is 44×44 on mobile (Apple HIG) and 28×28 on desktop where
  // density matters more. Visible square stays 16px in both cases.
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="cursor-pointer w-11 h-11 sm:w-7 sm:h-7 rounded-md flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 transition-colors"
      style={{
        color: checked || indeterminate ? 'rgb(184 92 56)' : 'rgb(122 111 100 / 0.4)',
      }}
    >
      <span
        className={[
          'block w-4 h-4 rounded border-[1.5px] transition-colors flex items-center justify-center',
          checked || indeterminate
            ? 'bg-terracotta border-terracotta'
            : 'bg-transparent border-ink/30 group-hover:border-ink/50',
        ].join(' ')}
      >
        {checked && <CheckIcon className="w-2.5 h-2.5 text-white" />}
        {indeterminate && (
          <span className="block w-2 h-[1.5px] bg-white rounded-full" />
        )}
      </span>
    </button>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
  trailing,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        'cursor-pointer w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
        danger
          ? 'text-terracotta-dark hover:bg-terracotta/10'
          : 'text-ink hover:bg-ivory-100',
      ].join(' ')}
    >
      <span className={danger ? 'text-terracotta' : 'text-ink-muted'}>{icon}</span>
      <span className="flex-1">{children}</span>
      {trailing}
    </button>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  tone,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  tone: 'danger' | 'muted';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="modal-scroll-lock fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="modal-mobile-bottom w-full max-w-lg bg-ivory-50 rounded-3xl p-6 shadow-lift"
      >
        <h2 className="display-xl text-2xl sm:text-3xl mb-2">{title}</h2>
        <p className="text-ink-soft mb-6">{body}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer px-4 py-2.5 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'cursor-pointer px-5 py-2.5 rounded-full text-white font-medium transition-colors',
              tone === 'danger'
                ? 'bg-terracotta hover:bg-terracotta-dark'
                : 'bg-ink hover:bg-ink-soft',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EditInvitationModal({
  invitation,
  onClose,
  onSaved,
}: {
  invitation: InvitationWithRelations;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [guestName, setGuestName] = useState(invitation.guestName);
  const [cupos, setCupos] = useState(invitation.cupos);
  const [phone, setPhone] = useState(invitation.phone ?? '');
  const [notes, setNotes] = useState(invitation.notes ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateInvitation({
        id: invitation.id,
        guestName,
        cupos,
        phone: phone || null,
        notes: notes || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="modal-scroll-lock fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="modal-mobile-bottom w-full max-w-lg bg-ivory-50 rounded-3xl p-6 shadow-lift max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={submit} className="space-y-4">
          <header>
            <p className="eyebrow text-terracotta">Editar invitación</p>
            <h2 className="display-xl text-3xl mt-1">{invitation.guestName}</h2>
          </header>
          <label className="block">
            <span className="text-sm text-ink-soft">Nombre</span>
            <input
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink-soft">Cupos</span>
            <input
              required
              type="number"
              min={1}
              max={99}
              value={cupos}
              onChange={(e) => setCupos(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink-soft">Teléfono</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink-soft">Notas internas</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
            />
          </label>
          {error && <p className="text-sm text-terracotta-dark" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2.5 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer px-5 py-2.5 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function buildWhatsappMessage(guestName: string, link: string): string {
  return (
    `¡Hola, ${guestName}! 💛\n\n` +
    `Somos ${process.env.NEXT_PUBLIC_COUPLE_NAME ?? 'los novios'}. ` +
    `Queremos compartir contigo todos los detalles de nuestra boda. ` +
    `Entra a tu invitación personal aquí:\n\n${link}\n\n` +
    `Ahí podrás confirmar cuántos vienen y elegir plato y bebida. ` +
    `¡Gracias por acompañarnos!`
  );
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const iconBase = 'w-4 h-4';

function CheckIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}
function DotsIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}
function EditIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14 4 L20 10 L8 22 L2 22 L2 16 Z" /><path d="M13 5 L19 11" />
    </svg>
  );
}
function TrashIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 7 L20 7" /><path d="M9 7 L9 4 L15 4 L15 7" />
      <path d="M6 7 L7 21 L17 21 L18 7" /><path d="M10 11 L10 17 M14 11 L14 17" />
    </svg>
  );
}
function CopyIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15 L5 5 L15 5" />
    </svg>
  );
}
function ChatIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 12 a9 9 0 0 1 -9 9 L3 21 L4 17 a9 9 0 0 1 17 -5" />
    </svg>
  );
}
function ChevronDownIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  );
}
function CloseIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  );
}
function UsersIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" />
      <path d="M3 20 v-1 a4 4 0 0 1 4 -4 h4 a4 4 0 0 1 4 4 v1" />
      <path d="M15 20 v-1 a3.5 3.5 0 0 1 2.5 -3.4" />
    </svg>
  );
}
function BellIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 8 a6 6 0 0 1 12 0 c0 5 2 6 2 8 H4 c0 -2 2 -3 2 -8 Z" />
      <path d="M10 19 a2 2 0 0 0 4 0" />
    </svg>
  );
}

function priority(i: InvitationWithRelations): number {
  // Lower = higher priority (appears first)
  if (i.status === 'PENDING' && !i.firstOpenedAt) return 0;
  if (i.status === 'PENDING') return 1;
  if (i.status === 'CONFIRMED') return 2;
  if (i.status === 'DECLINED') return 3;
  return 4;
}
