'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  deleteGift,
  manualReserveGift,
  reorderGifts,
} from '@/actions/admin';
import GiftFormModal from './GiftFormModal';

type GiftWithReservation = Prisma.GiftGetPayload<{
  include: { reservedBy: { select: { id: true; guestName: true; token: true } } };
}>;

type InvitationOption = { id: string; guestName: string; token: string };

type EditState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; gift: GiftWithReservation };

type FilterKey = 'all' | 'available' | 'reserved' | 'hidden';

// -----------------------------------------------------------------------------
// Public exports (must remain named — see MEMORY note on RSC bundler).
// -----------------------------------------------------------------------------

export function AddButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors duration-200"
      >
        <PlusIcon className="w-4 h-4" />
        Agregar regalo
      </button>
      <AnimatePresence>
        {open && <GiftFormModal mode="add" onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

export function List({
  gifts,
  invitations,
}: {
  gifts: GiftWithReservation[];
  invitations: InvitationOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Track which specific gift is being mutated so the right card shows a
  // loader. `pending` alone is too coarse — we don't know *which* card to
  // show the spinner on.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState>({ mode: 'closed' });
  const [reserveFor, setReserveFor] = useState<GiftWithReservation | null>(null);
  const [deleteFor, setDeleteFor] = useState<GiftWithReservation | null>(null);

  // Local UI state — does not need to persist; resets on navigation.
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  // Counts for the header chips (always reflect full list, not filtered).
  const counts = useMemo(
    () => ({
      all: gifts.length,
      available: gifts.filter((g) => !g.reservedById && g.active).length,
      reserved: gifts.filter((g) => !!g.reservedById).length,
      hidden: gifts.filter((g) => !g.active).length,
    }),
    [gifts],
  );

  // Filtered + sorted list.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gifts.filter((g) => {
      if (filter === 'available' && (g.reservedById || !g.active)) return false;
      if (filter === 'reserved' && !g.reservedById) return false;
      if (filter === 'hidden' && g.active) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [gifts, filter, search]);

  const reserved = filtered.filter((g) => g.reservedById);
  const available = filtered.filter((g) => !g.reservedById);

  const move = (id: string, dir: -1 | 1) => {
    const idx = gifts.findIndex((g) => g.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= gifts.length) return;
    const reordered = [...gifts];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, removed);
    setBusyId(id);
    startTransition(async () => {
      try {
        await reorderGifts({ ids: reordered.map((g) => g.id) });
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  };

  const confirmDelete = (gift: GiftWithReservation) => {
    setDeleteFor(null);
    setBusyId(gift.id);
    startTransition(async () => {
      try {
        const result = await deleteGift({ id: gift.id });
        if (!result.ok) alert(result.error);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  };

  const confirmRelease = (gift: GiftWithReservation) => {
    setBusyId(gift.id);
    startTransition(async () => {
      try {
        const result = await manualReserveGift({ giftId: gift.id, invitationId: null });
        if (!result.ok) alert(result.error);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  };

  if (gifts.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-12 text-center">
        <EmptyBoxIcon className="w-12 h-12 mx-auto text-ink-muted/40 mb-4" />
        <p className="font-display text-xl text-ink mb-1">Aún no hay regalos</p>
        <p className="text-sm text-ink-muted">
          Cuando agregues el primero aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-soft p-3 mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar regalos"
            className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-ivory-50 border border-ink/10 rounded-full text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/40"
          />
        </div>
        <FilterChips current={filter} onChange={setFilter} counts={counts} />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft p-12 text-center">
          <p className="text-ink-muted">
            No hay regalos que coincidan con tu búsqueda.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {reserved.length > 0 && (
            <section>
              <SectionHeader
                label="Apartados"
                count={reserved.length}
                accent="sage"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {reserved.map((g) => (
                  <GiftCard
                    key={g.id}
                    gift={g}
                    isFirst={gifts[0]?.id === g.id}
                    isLast={gifts[gifts.length - 1]?.id === g.id}
                    onEdit={() => setEditing({ mode: 'edit', gift: g })}
                    onReserve={() => setReserveFor(g)}
                    onRelease={() => confirmRelease(g)}
                    onDelete={() => setDeleteFor(g)}
                    onMoveUp={() => move(g.id, -1)}
                    onMoveDown={() => move(g.id, 1)}
                    disabled={pending || busyId === g.id}
                    busy={busyId === g.id}
                  />
                ))}
              </div>
            </section>
          )}

          {available.length > 0 && (
            <section>
              <SectionHeader
                label="Disponibles"
                count={available.length}
                accent="terracotta"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {available.map((g) => (
                  <GiftCard
                    key={g.id}
                    gift={g}
                    isFirst={gifts[0]?.id === g.id}
                    isLast={gifts[gifts.length - 1]?.id === g.id}
                    onEdit={() => setEditing({ mode: 'edit', gift: g })}
                    onReserve={() => setReserveFor(g)}
                    onRelease={() => confirmRelease(g)}
                    onDelete={() => setDeleteFor(g)}
                    onMoveUp={() => move(g.id, -1)}
                    onMoveDown={() => move(g.id, 1)}
                    disabled={pending || busyId === g.id}
                    busy={busyId === g.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <AnimatePresence>
        {editing.mode !== 'closed' && (
          <GiftFormModal
            mode={editing.mode === 'add' ? 'add' : 'edit'}
            gift={editing.mode === 'edit' ? editing.gift : undefined}
            onClose={() => setEditing({ mode: 'closed' })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reserveFor && (
          <ReserveModal
            gift={reserveFor}
            invitations={invitations}
            onClose={() => setReserveFor(null)}
            onConfirm={async (invitationId) => {
              const result = await manualReserveGift({
                giftId: reserveFor.id,
                invitationId,
              });
              if (!result.ok) {
                alert(result.error);
                return false;
              }
              setReserveFor(null);
              router.refresh();
              return true;
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteFor && (
          <ConfirmModal
            title="¿Eliminar este regalo?"
            body={`"${deleteFor.name}" se quitará de la lista. Si alguien lo tenía apartado, la reserva se libera.`}
            confirmLabel="Eliminar"
            tone="danger"
            onCancel={() => setDeleteFor(null)}
            onConfirm={() => confirmDelete(deleteFor)}
            pending={pending}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// -----------------------------------------------------------------------------
// Card
// -----------------------------------------------------------------------------

function GiftCard({
  gift,
  isFirst,
  isLast,
  onEdit,
  onReserve,
  onRelease,
  onDelete,
  onMoveUp,
  onMoveDown,
  disabled,
  busy = false,
}: {
  gift: GiftWithReservation;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onReserve: () => void;
  onRelease: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled: boolean;
  busy?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const reserved = !!gift.reservedBy;

  return (
    <>
    <motion.article
      layout
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={[
        // Mobile: horizontal row (thumbnail + content + dots).
        // Desktop (sm+): vertical card, image on top.
        'group relative bg-white rounded-2xl shadow-soft overflow-hidden flex flex-row sm:flex-col transition-shadow hover:shadow-lift',
        !gift.active ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Busy overlay — covers the card while a reorder/delete/release is
          in flight. Tells the user something is happening (the round-trip
          can take a couple seconds on Neon's free tier). */}
      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex items-center justify-center gap-2 text-xs text-ink-muted rounded-2xl"
            role="status"
            aria-live="polite"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="w-4 h-4 animate-spin text-terracotta"
              aria-hidden
            >
              <path d="M12 3 A9 9 0 0 1 21 12" />
            </svg>
            <span>Guardando…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thumbnail — square on mobile (smaller), full card-width on desktop */}
      <div className="relative w-24 h-24 sm:w-auto sm:aspect-square shrink-0 bg-ivory-100 overflow-hidden">
        {gift.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gift.imageUrl}
            alt={gift.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ivory-100 to-ivory-200">
            <GiftIcon className="w-10 h-10 sm:w-20 sm:h-20 text-ink/15" />
          </div>
        )}

        {/* Status badges — desktop only on the image, mobile shows them in
            the content area to keep the thumbnail clean. */}
        <div className="absolute top-3 left-3 hidden sm:flex gap-1.5">
          {reserved && (
            <span className="inline-flex items-center gap-1 bg-sage text-white text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
              <CheckIcon className="w-3 h-3" />
              Apartado
            </span>
          )}
          {!gift.active && (
            <span className="bg-ink/70 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              Oculto
            </span>
          )}
        </div>

        {/* Action menu trigger — desktop only. On mobile it's placed inline in
            the content row (see below) so it doesn't cover the photo. */}
        <div ref={menuRef} className="hidden sm:block sm:absolute sm:top-3 sm:right-3">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Más acciones"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="cursor-pointer w-10 h-10 rounded-full bg-white/95 backdrop-blur shadow-soft flex items-center justify-center text-ink hover:bg-white transition-colors"
          >
            <DotsIcon className="w-4 h-4" />
          </button>

          {/* Desktop dropdown — anchored to the trigger. Hidden on mobile. */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-lift border border-ink/5 overflow-hidden z-10 py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <MenuItem icon={<EditIcon className="w-4 h-4" />} onClick={() => { setMenuOpen(false); onEdit(); }}>
                  Editar
                </MenuItem>
                <div className="h-px bg-ink/5 my-1" />
                <MenuItem
                  icon={<ArrowUpIcon className="w-4 h-4" />}
                  onClick={() => { setMenuOpen(false); onMoveUp(); }}
                  disabled={isFirst || disabled}
                >
                  Mover arriba
                </MenuItem>
                <MenuItem
                  icon={<ArrowDownIcon className="w-4 h-4" />}
                  onClick={() => { setMenuOpen(false); onMoveDown(); }}
                  disabled={isLast || disabled}
                >
                  Mover abajo
                </MenuItem>
                <div className="h-px bg-ink/5 my-1" />
                {reserved ? (
                  <MenuItem icon={<UnreserveIcon className="w-4 h-4" />} onClick={() => { setMenuOpen(false); onRelease(); }}>
                    Liberar reserva
                  </MenuItem>
                ) : (
                  <MenuItem icon={<ReserveIcon className="w-4 h-4" />} onClick={() => { setMenuOpen(false); onReserve(); }}>
                    Apartar a nombre de…
                  </MenuItem>
                )}
                <div className="h-px bg-ink/5 my-1" />
                <MenuItem
                  icon={<TrashIcon className="w-4 h-4" />}
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  danger
                >
                  Eliminar
                </MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content — flex-row on mobile (compact), flex-col on desktop. */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col gap-1 sm:gap-1.5 min-w-0 justify-center sm:justify-start">
        {/* Mobile-only status row (badges that we hid from the thumbnail) */}
        {(reserved || !gift.active) && (
          <div className="flex sm:hidden gap-1.5 text-[0.65rem]">
            {reserved && (
              <span className="inline-flex items-center gap-1 bg-sage/15 text-sage-dark font-medium px-2 py-0.5 rounded-full">
                <CheckIcon className="w-2.5 h-2.5" />
                Apartado
              </span>
            )}
            {!gift.active && (
              <span className="bg-ink/10 text-ink-muted font-medium px-2 py-0.5 rounded-full">
                Oculto
              </span>
            )}
          </div>
        )}

        <h3 className="font-display text-base leading-tight text-ink line-clamp-2">
          {gift.name}
        </h3>

        {gift.description && (
          <p className="text-xs text-ink-muted line-clamp-2 leading-snug hidden sm:block">
            {gift.description}
          </p>
        )}

        {/* Bottom row — pushed to the end so all cards align on desktop.
            On mobile the "···" button lives here, next to the store link,
            so it doesn't overlap the gift photo. */}
        <div className="mt-auto sm:pt-2 flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 truncate">
            {gift.reservedBy ? (
              <span className="text-sage-dark">
                <span className="text-ink-muted/70 hidden sm:inline">Por </span>
                <strong className="font-medium">{gift.reservedBy.guestName}</strong>
              </span>
            ) : (
              <span className="text-ink-muted/50">Disponible</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {gift.storeUrl ? (
              <a
                href={gift.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer inline-flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto text-terracotta-dark hover:text-terracotta"
                aria-label={`Ver tienda para ${gift.name}`}
              >
                <ExternalIcon className="w-3.5 h-3.5" />
              </a>
            ) : null}
            {/* Mobile-only action button — desktop version lives in the
                thumbnail corner (see above). Opens the bottom sheet. */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Más acciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="sm:hidden cursor-pointer w-8 h-8 rounded-full text-ink-muted hover:bg-ivory-100 hover:text-ink transition-colors flex items-center justify-center"
            >
              <DotsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>

    {/* Action menu — bottom sheet on mobile (always reachable, never clipped),
        anchored dropdown on desktop. Rendered outside the article to escape
        its stacking context. */}
    <AnimatePresence>
      {menuOpen && (
        <>
          {/* Mobile bottom sheet */}
          <div
            className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-ink/40"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="menu"
              className="w-full bg-ivory-50 rounded-t-3xl shadow-lift overflow-hidden pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex justify-center pt-3 pb-1">
                <span className="w-10 h-1 rounded-full bg-ink/15" />
              </div>
              <div className="px-2 pt-1 pb-3">
                <p className="px-4 pt-2 pb-3 text-sm text-ink-soft font-display italic truncate border-b border-ink/5">
                  {gift.name}
                </p>
                <SheetItem icon={<EditIcon className="w-5 h-5" />} onClick={() => { setMenuOpen(false); onEdit(); }}>
                  Editar regalo
                </SheetItem>
                <div className="h-px bg-ink/5 mx-3" />
                <SheetItem
                  icon={<ArrowUpIcon className="w-5 h-5" />}
                  onClick={() => { setMenuOpen(false); onMoveUp(); }}
                  disabled={isFirst || disabled}
                >
                  Mover arriba
                </SheetItem>
                <SheetItem
                  icon={<ArrowDownIcon className="w-5 h-5" />}
                  onClick={() => { setMenuOpen(false); onMoveDown(); }}
                  disabled={isLast || disabled}
                >
                  Mover abajo
                </SheetItem>
                <div className="h-px bg-ink/5 mx-3" />
                {reserved ? (
                  <SheetItem icon={<UnreserveIcon className="w-5 h-5" />} onClick={() => { setMenuOpen(false); onRelease(); }}>
                    Liberar reserva
                  </SheetItem>
                ) : (
                  <SheetItem icon={<ReserveIcon className="w-5 h-5" />} onClick={() => { setMenuOpen(false); onReserve(); }}>
                    Apartar a nombre de…
                  </SheetItem>
                )}
                <div className="h-px bg-ink/5 mx-3" />
                <SheetItem icon={<TrashIcon className="w-5 h-5" />} onClick={() => { setMenuOpen(false); onDelete(); }} danger>
                  Eliminar regalo
                </SheetItem>
                <div className="h-px bg-ink/5 mx-3 my-1" />
                <SheetItem onClick={() => setMenuOpen(false)}>Cancelar</SheetItem>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
        disabled
          ? 'text-ink-muted/40 cursor-not-allowed'
          : danger
          ? 'text-terracotta-dark hover:bg-terracotta/10 cursor-pointer'
          : 'text-ink hover:bg-ivory-100 cursor-pointer',
      ].join(' ')}
    >
      <span className={disabled ? 'text-ink-muted/40' : danger ? 'text-terracotta' : 'text-ink-muted'}>
        {icon}
      </span>
      {children}
    </button>
  );
}

// Bigger touch targets for the mobile bottom sheet (min ~56px tall).
function SheetItem({
  icon,
  children,
  onClick,
  danger,
  disabled,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-3 px-4 min-h-[52px] text-base text-left transition-colors',
        disabled
          ? 'text-ink-muted/40 cursor-not-allowed'
          : danger
          ? 'text-terracotta-dark hover:bg-terracotta/10 cursor-pointer'
          : 'text-ink hover:bg-ivory-100 cursor-pointer',
      ].join(' ')}
    >
      {icon && (
        <span className={disabled ? 'text-ink-muted/40' : danger ? 'text-terracotta' : 'text-ink-muted'}>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

function SectionHeader({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: 'sage' | 'terracotta';
}) {
  return (
    <div className="flex items-baseline gap-3 mb-3 px-1">
      <span
        className={[
          'w-1.5 h-5 rounded-full',
          accent === 'sage' ? 'bg-sage' : 'bg-terracotta',
        ].join(' ')}
      />
      <h2 className="font-display text-2xl text-ink">{label}</h2>
      <span className="text-xs text-ink-muted">·</span>
      <span className="text-xs text-ink-muted">{count}</span>
    </div>
  );
}

function FilterChips({
  current,
  onChange,
  counts,
}: {
  current: FilterKey;
  onChange: (k: FilterKey) => void;
  counts: { all: number; available: number; reserved: number; hidden: number };
}) {
  const items: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: counts.all },
    { key: 'available', label: 'Disponibles', count: counts.available },
    { key: 'reserved', label: 'Apartados', count: counts.reserved },
    { key: 'hidden', label: 'Ocultos', count: counts.hidden },
  ];
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto snap-x snap-mandatory scrollbar-none" role="tablist" aria-label="Filtrar regalos">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={current === it.key}
          onClick={() => onChange(it.key)}
          className={[
            'cursor-pointer px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors shrink-0 snap-start',
            current === it.key
              ? 'bg-ink text-white'
              : 'bg-ivory-100 text-ink-muted hover:text-ink hover:bg-ivory-200',
          ].join(' ')}
        >
          {it.label}
          <span className="ml-1.5 opacity-70">{it.count}</span>
        </button>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Modals
// -----------------------------------------------------------------------------

function ReserveModal({
  gift,
  invitations,
  onClose,
  onConfirm,
}: {
  gift: GiftWithReservation;
  invitations: InvitationOption[];
  onClose: () => void;
  onConfirm: (invitationId: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invitations;
    return invitations.filter((i) => i.guestName.toLowerCase().includes(q));
  }, [invitations, query]);

  const submit = () => {
    if (!pickedId) return;
    setPending(true);
    setError(null);
    onConfirm(pickedId)
      .catch((e) => setError(e?.message ?? 'Error'))
      .finally(() => setPending(false));
  };

  return (
    <ModalShell onClose={onClose} wide>
      <div className="space-y-4">
        <header>
          <p className="eyebrow text-terracotta">Apartar a nombre de</p>
          <h2 className="display-xl text-3xl mt-1">{gift.name}</h2>
        </header>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar invitado…"
            aria-label="Buscar invitado"
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 border border-ink/10 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/40"
          />
        </div>

        <ul
          role="listbox"
          aria-label="Invitados"
          className="max-h-72 overflow-y-auto border border-ink/10 rounded-2xl divide-y divide-ink/5"
        >
          {filtered.length === 0 ? (
            <li className="p-4 text-center text-sm text-ink-muted">
              No hay invitados que coincidan.
            </li>
          ) : (
            filtered.map((inv) => {
              const selected = pickedId === inv.id;
              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setPickedId(inv.id)}
                    className={[
                      'cursor-pointer w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                      selected ? 'bg-terracotta/10' : 'hover:bg-ivory-100',
                    ].join(' ')}
                  >
                    <span className="font-medium">{inv.guestName}</span>
                    {selected && <CheckIcon className="w-4 h-4 text-terracotta" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {error && (
          <p className="text-sm text-terracotta-dark" role="alert">
            {error}
          </p>
        )}

        <footer className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="cursor-pointer px-4 py-2.5 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!pickedId || pending}
            className="cursor-pointer px-5 py-2.5 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Apartando…' : 'Apartar'}
          </button>
        </footer>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  tone,
  onCancel,
  onConfirm,
  pending,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  tone: 'danger' | 'muted';
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="space-y-4">
        <h2 className="display-xl text-3xl">{title}</h2>
        <p className="text-ink-soft">{body}</p>
        <footer className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="cursor-pointer px-4 py-2.5 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={[
              'cursor-pointer px-5 py-2.5 rounded-full text-white font-medium transition-colors disabled:opacity-50',
              tone === 'danger'
                ? 'bg-terracotta hover:bg-terracotta-dark'
                : 'bg-ink hover:bg-ink-soft',
            ].join(' ')}
          >
            {pending ? '…' : confirmLabel}
          </button>
        </footer>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
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
        className={[
          'modal-mobile-bottom w-full bg-ivory-50 rounded-3xl p-6 shadow-lift max-h-[90vh] overflow-y-auto',
          wide ? 'max-w-xl' : 'max-w-lg',
        ].join(' ')}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink-soft">
        {label}
        {required && <span className="text-terracotta-dark ml-1">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// -----------------------------------------------------------------------------
// Icons (inline SVG — no emoji, no extra deps)
// -----------------------------------------------------------------------------

const iconBase = 'w-4 h-4';

function PlusIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 5 L12 19 M5 12 L19 12" />
    </svg>
  );
}
function SearchIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 L16 16" />
    </svg>
  );
}
function DotsIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}
function EditIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14 4 L20 10 L8 22 L2 22 L2 16 Z" />
      <path d="M13 5 L19 11" />
    </svg>
  );
}
function TrashIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 7 L20 7" />
      <path d="M9 7 L9 4 L15 4 L15 7" />
      <path d="M6 7 L7 21 L17 21 L18 7" />
      <path d="M10 11 L10 17 M14 11 L14 17" />
    </svg>
  );
}
function ReserveIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 7 L4 7 L4 20 L20 20 Z" />
      <path d="M8 7 L8 4 L16 4 L16 7" />
      <path d="M12 11 L12 17 M9 14 L15 14" />
    </svg>
  );
}
function UnreserveIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 7 L4 7 L4 20 L20 20 Z" />
      <path d="M8 7 L8 4 L16 4 L16 7" />
      <path d="M9 14 L15 14" />
    </svg>
  );
}
function CheckIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}
function ExternalIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14 4 L20 4 L20 10" />
      <path d="M20 4 L11 13" />
      <path d="M19 14 L19 19 L5 19 L5 5 L10 5" />
    </svg>
  );
}
function ArrowUpIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 19 L12 5 M5 12 L12 5 L19 12" />
    </svg>
  );
}
function ArrowDownIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 5 L12 19 M5 12 L12 19 L19 12" />
    </svg>
  );
}
function GiftIcon({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 9 L21 9 L21 20 L3 20 Z" />
      <path d="M3 9 L3 6 L21 6 L21 9" />
      <path d="M12 6 L12 20" />
      <path d="M12 6 C 9 6 7 4 8 3 C 9 2 11 3 12 6 C 13 3 15 2 16 3 C 17 4 15 6 12 6 Z" />
    </svg>
  );
}
function EmptyBoxIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 9 L21 9 L21 20 L3 20 Z" />
      <path d="M3 9 L3 6 L21 6 L21 9" />
      <path d="M12 6 L12 20" />
    </svg>
  );
}
function SparkleIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z" />
      <path d="M18 16 L18.6 18 L20.6 18.6 L18.6 19.2 L18 21 L17.4 19.2 L15.4 18.6 L17.4 18 Z" />
    </svg>
  );
}
function SpinnerIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 3 A9 9 0 0 1 21 12" />
    </svg>
  );
}
