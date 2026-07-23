'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { motion, AnimatePresence } from 'framer-motion';
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

export default function InvitationsList({
  invitations,
  baseUrl,
  isFiltered = false,
  totalCount,
}: {
  invitations: InvitationWithRelations[];
  baseUrl: string;
  isFiltered?: boolean;
  totalCount?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('status');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = invitations;
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
      // PENDING first (needs attention), then PENDING-not-opened, then others
      sorted.sort((a, b) => priority(a) - priority(b));
    } else {
      sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return sorted;
  }, [invitations, search, sort]);

  // Clear selection when the filter changes the underlying list.
  useEffect(() => {
    if (selected.size === 0) return;
    const valid = new Set(invitations.map((i) => i.id));
    const next = new Set<string>();
    for (const id of selected) if (valid.has(id)) next.add(id);
    if (next.size !== selected.size) setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitations]);

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  const clearSelection = () => setSelected(new Set());

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
        <p className="font-display text-2xl text-ink mb-1">
          {isFiltered ? 'Sin resultados' : 'Sin invitaciones'}
        </p>
        <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto leading-relaxed">
          {isFiltered
            ? 'Ninguna invitación coincide con los filtros activos. Probá cambiarlos arriba.'
            : 'Creá la primera desde el botón de arriba a la derecha.'}
        </p>
        {isFiltered && (
          <a
            href="/admin"
            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink text-ivory-50 text-sm font-medium hover:bg-ink-soft transition-colors"
          >
            Ver todas las invitaciones
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + sort toolbar */}
      <div className="bg-white rounded-2xl shadow-soft p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20 L16 16" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar invitados"
            className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-ivory-50 border border-ink/10 rounded-full text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/40"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Ordenar"
          className="cursor-pointer px-4 py-2.5 sm:py-2 bg-ivory-50 border border-ink/10 rounded-full text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        >
          <option value="status">Prioridad</option>
          <option value="recent">Más recientes</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>

      {/* Bulk select bar (appears when ≥1 selected) */}
      <AnimatePresence>
        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            invitations={invitations.filter((i) => selected.has(i.id))}
            baseUrl={baseUrl}
            onClear={clearSelection}
            onDeleted={() => {
              setSelected(new Set());
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Select all row */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-2 py-1 text-xs text-ink-muted">
          <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} ariaLabel="Seleccionar todo" />
          <span>
            <strong className="font-medium text-ink-soft">{filtered.length}</strong>{' '}
            {filtered.length === 1 ? 'invitación' : 'invitaciones'}
            {search && (
              <span className="text-ink-muted">
                {' '}
                (filtradas de {invitations.length})
              </span>
            )}
            {!search && filtered && totalCount != null && filtered.length !== totalCount && (
              <span className="text-ink-muted">
                {' '}
                de {totalCount}
              </span>
            )}
          </span>
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
              Probá con otro nombre, teléfono o nota.
            </p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors text-sm"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          filtered.map((inv) => (
            <InvitationCard
              key={inv.id}
              invitation={inv}
              baseUrl={baseUrl}
              isSelected={selected.has(inv.id)}
              isExpanded={expanded.has(inv.id)}
              onToggleSelected={() => toggleSelected(inv.id)}
              onToggleExpanded={() => toggleExpanded(inv.id)}
              onChanged={() => router.refresh()}
            />
          ))
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Bulk action bar
// -----------------------------------------------------------------------------

function BulkBar({
  count,
  invitations,
  baseUrl,
  onClear,
  onDeleted,
}: {
  count: number;
  invitations: InvitationWithRelations[];
  baseUrl: string;
  onClear: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copyAll = async () => {
    const text = invitations
      .map((i) => `${i.guestName}: ${buildInvitationLink(baseUrl, i.token)}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copia estos enlaces:', text);
    }
  };

  const openWhatsAppBulk = () => {
    // WhatsApp doesn't support multi-recipient. Open the first; admin can repeat.
    const first = invitations.find((i) => i.phone);
    if (!first) return;
    const url = buildWhatsAppUrl(first.phone, buildWhatsappMessage(first.guestName, buildInvitationLink(baseUrl, first.token)));
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const anyPhone = invitations.some((i) => i.phone);

  const removeAll = () => {
    startTransition(async () => {
      for (const inv of invitations) {
        await deleteInvitation({ id: inv.id });
      }
      setConfirmDelete(false);
      onDeleted();
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="sticky top-[5.5rem] sm:top-20 z-20 bg-ink text-white rounded-2xl shadow-lift px-4 py-3 flex flex-wrap items-center gap-3"
      >
        <span className="font-medium">
          {count} {count === 1 ? 'seleccionado' : 'seleccionados'}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copyAll}
          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-sm"
        >
          <CopyIcon className="w-3.5 h-3.5" />
          Copiar enlaces
        </button>
        {anyPhone && (
          <button
            type="button"
            onClick={openWhatsAppBulk}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sage hover:bg-sage-dark transition-colors text-sm"
          >
            <ChatIcon className="w-3.5 h-3.5" />
            Abrir WhatsApp
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-terracotta hover:bg-terracotta-dark transition-colors text-sm"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          Eliminar
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpiar selección"
          className="cursor-pointer w-8 h-8 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </motion.div>

      <AnimatePresence>
        {confirmDelete && (
          <ConfirmModal
            title={`¿Eliminar ${count} ${count === 1 ? 'invitación' : 'invitaciones'}?`}
            body="Se eliminarán también sus asistentes y se liberarán los regalos que tengan apartados. No se puede deshacer."
            confirmLabel={pending ? 'Eliminando…' : `Eliminar ${count}`}
            tone="danger"
            onCancel={() => setConfirmDelete(false)}
            onConfirm={removeAll}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// -----------------------------------------------------------------------------
// Individual invitation card
// -----------------------------------------------------------------------------

function InvitationCard({
  invitation,
  baseUrl,
  isSelected,
  isExpanded,
  onToggleSelected,
  onToggleExpanded,
  onChanged,
}: {
  invitation: InvitationWithRelations;
  baseUrl: string;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const link = buildInvitationLink(baseUrl, invitation.token);
  const whatsappMessage = buildWhatsappMessage(invitation.guestName, link);
  const whatsappUrl = buildWhatsAppUrl(invitation.phone, whatsappMessage);

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

  const copy = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      window.prompt('Copia este enlace:', link);
    }
  };

  const remove = () => {
    setMenuOpen(false);
    setDeleting(false);
    startTransition(async () => {
      const result = await deleteInvitation({ id: invitation.id });
      if (!result.ok) alert(result.error);
      onChanged();
    });
  };

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

  return (
    <>
      <motion.article
        layout
        transition={{ duration: 0.2 }}
        className={[
          'group relative bg-white rounded-2xl shadow-soft overflow-hidden transition-all',
          isSelected ? 'ring-2 ring-terracotta/40' : 'hover:shadow-lift',
          invitation.status === 'DECLINED' ? 'opacity-70' : '',
        ].join(' ')}
      >
        {/* Left accent bar */}
        <div className={['absolute left-0 top-0 bottom-0 w-1', accentColor].join(' ')} />

        <div className="pl-5 pr-3 py-4 sm:pl-6 sm:pr-4 sm:py-5 flex items-start gap-3 sm:gap-4">
          {/* Checkbox */}
          <div className="pt-0.5 sm:pt-1">
            <Checkbox
              checked={isSelected}
              onChange={onToggleSelected}
              ariaLabel={`Seleccionar a ${invitation.guestName}`}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Top row: name + status */}
            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <h3 className="font-display text-lg sm:text-xl text-ink truncate min-w-0 max-w-full">
                {invitation.guestName}
              </h3>
              <StatusBadge status={invitation.status} />
            </div>

            {/* Meta row: cupos + opened flag — on its own line on mobile */}
            <div className="flex items-center gap-2 sm:gap-3 mt-1.5 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 bg-ivory-100 text-ink-soft px-2.5 py-1 rounded-full">
                <UsersIcon className="w-3 h-3" />
                {invitation.attending != null ? `${invitation.attending} / ${invitation.cupos}` : `${invitation.cupos} cupos`}
              </span>
              {invitation.firstOpenedAt ? (
                <span className="inline-flex items-center gap-1 text-sage-dark" title={`Abierto el ${new Date(invitation.firstOpenedAt).toLocaleDateString('es-CO')}`}>
                  <CheckIcon className="w-3 h-3" />
                  abierto
                </span>
              ) : showAttentionBadge ? (
                <span className="inline-flex items-center gap-1 text-terracotta-dark font-medium">
                  <BellIcon className="w-3 h-3" />
                  no abrió
                </span>
              ) : null}
            </div>

            {/* Phone + notes */}
            {(invitation.phone || invitation.notes) && (
              <p className="text-xs text-ink-muted mt-2 truncate">
                {invitation.phone && <span>{invitation.phone}</span>}
                {invitation.phone && invitation.notes && <span className="mx-2">·</span>}
                {invitation.notes && <em className="italic">"{invitation.notes}"</em>}
              </p>
            )}

            {/* Summary chips */}
            {(attendeeCount > 0 || giftCount > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 text-xs">
                {attendeeCount > 0 && (
                  <span className="bg-ivory-100 text-ink-soft px-2.5 py-1 rounded-full">
                    {attendeeCount} {attendeeCount === 1 ? 'asistente' : 'asistentes'}
                  </span>
                )}
                {giftCount > 0 && (
                  <span className="bg-ivory-100 text-ink-soft px-2.5 py-1 rounded-full">
                    {giftCount} {giftCount === 1 ? 'regalo' : 'regalos'}
                  </span>
                )}
              </div>
            )}

            {/* Expanded details */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-ink/10 grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="smallcaps text-ink-muted mb-2">Asistentes y comida</p>
                      {attendeeCount === 0 ? (
                        <p className="text-sm text-ink-muted italic">Sin asistentes.</p>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {invitation.attendees.map((a) => (
                            <li key={a.id}>
                              <span className="text-ink font-medium">{a.name}</span>
                              <span className="text-ink-muted">
                                {' · '}
                                {a.mainDish?.name ?? 'Sin plato'}
                                {' · '}
                                {a.drink?.name ?? 'Sin bebida'}
                              </span>
                              {a.dietaryNotes && (
                                <span className="block text-xs text-ink-muted italic ml-0">
                                  "{a.dietaryNotes}"
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="smallcaps text-ink-muted mb-2">Regalos apartados</p>
                      {giftCount === 0 ? (
                        <p className="text-sm text-ink-muted italic">Sin regalos.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {invitation.gifts.map((g) => (
                            <li
                              key={g.id}
                              className="text-xs bg-ivory-100 text-ink-soft px-2.5 py-1 rounded-full"
                            >
                              {g.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Expand toggle */}
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-label={isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
              aria-expanded={isExpanded}
              className="cursor-pointer w-11 h-11 sm:w-10 sm:h-10 rounded-full text-ink-muted hover:bg-ivory-100 hover:text-ink transition-colors flex items-center justify-center"
            >
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex"
              >
                <ChevronDownIcon className="w-4 h-4" />
              </motion.span>
            </button>

            {/* Action menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Más acciones"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="cursor-pointer w-11 h-11 sm:w-10 sm:h-10 rounded-full text-ink-muted hover:bg-ivory-100 hover:text-ink transition-colors flex items-center justify-center"
              >
                <DotsIcon className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    role="menu"
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lift border border-ink/5 overflow-hidden z-10 py-1"
                  >
                    <MenuItem
                      icon={<CopyIcon className="w-4 h-4" />}
                      onClick={copy}
                      trailing={copyState === 'copied' ? <CheckIcon className="w-3.5 h-3.5 text-sage" /> : null}
                    >
                      {copyState === 'copied' ? '¡Copiado!' : 'Copiar enlace'}
                    </MenuItem>
                    {whatsappUrl && (
                      <MenuItem
                        icon={<ChatIcon className="w-4 h-4" />}
                        onClick={() => { setMenuOpen(false); window.open(whatsappUrl, '_blank', 'noopener,noreferrer'); }}
                      >
                        Enviar WhatsApp
                      </MenuItem>
                    )}
                    <div className="h-px bg-ink/5 my-1" />
                    <MenuItem icon={<EditIcon className="w-4 h-4" />} onClick={() => { setMenuOpen(false); setEditing(true); }}>
                      Editar
                    </MenuItem>
                    <div className="h-px bg-ink/5 my-1" />
                    <MenuItem
                      icon={<TrashIcon className="w-4 h-4" />}
                      onClick={() => { setMenuOpen(false); setDeleting(true); }}
                      danger
                    >
                      Eliminar
                    </MenuItem>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.article>

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
      : 'bg-terracotta/10 text-terracotta-dark';
  return (
    <span className={['inline-flex px-2.5 py-1 rounded-full text-xs font-medium', cls].join(' ')}>
      {rsvpStatusLabel(status)}
    </span>
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
