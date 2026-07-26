'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { motion, AnimatePresence } from 'framer-motion';
import { deleteMenuItem, reorderMenu, upsertMenuItem } from '@/actions/admin';

type MenuItem = Prisma.MenuItemGetPayload<{}>;

type EditState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; item: MenuItem };

export default function MenuManager({
  title,
  type,
  items,
}: {
  title: string;
  type: 'MAIN_DISH' | 'DRINK';
  items: MenuItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditState>({ mode: 'closed' });

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= items.length) return;
    const reordered = [...items];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, removed);
    startTransition(async () => {
      await reorderMenu({ type, ids: reordered.map((i) => i.id) });
      router.refresh();
    });
  };

  const remove = (it: MenuItem) => {
    if (
      !confirm(
        `¿Eliminar "${it.name}"? Los invitados que ya lo habían elegido quedarán sin selección.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteMenuItem({ id: it.id });
      if (!result.ok) alert(result.error);
      router.refresh();
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-5 flex items-center justify-between gap-3">
        <h2 className="display-xl text-2xl">{title}</h2>
        <button type="button" onClick={() => setEditing({ mode: 'add' })} className="btn btn-primary btn-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5" aria-hidden>
            <path d="M12 5 L12 19 M5 12 L19 12" />
          </svg>
          Agregar
        </button>
      </div>

      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink-muted">Aún no hay {title.toLowerCase()}.</p>
      ) : (
        <ul className="divide-y divide-ink/10 border-t border-ink/10">
          {items.map((it, idx) => (
            <li key={it.id} className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="font-medium">{it.name}</h3>
                  {!it.active && (
                    <span className="text-xs bg-ink/10 text-ink-muted px-2 py-0.5 rounded-full">
                      Oculto
                    </span>
                  )}
                </div>
                {it.description && (
                  <p className="text-sm text-ink-muted mt-1">{it.description}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(it.id, -1)}
                    disabled={idx === 0 || pending}
                    className="cursor-pointer w-9 h-9 rounded-full border border-ink/15 text-ink-soft hover:bg-ivory-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    aria-label="Subir"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                      <path d="M6 15 L12 9 L18 15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => move(it.id, 1)}
                    disabled={idx === items.length - 1 || pending}
                    className="cursor-pointer w-9 h-9 rounded-full border border-ink/15 text-ink-soft hover:bg-ivory-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    aria-label="Bajar"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                      <path d="M6 9 L12 15 L18 9" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: 'edit', item: it })}
                    className="btn btn-secondary btn-sm"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it)}
                    className="btn btn-danger btn-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {editing.mode !== 'closed' && (
          <MenuFormModal
            type={type}
            mode={editing.mode === 'add' ? 'add' : 'edit'}
            item={editing.mode === 'edit' ? editing.item : undefined}
            onClose={() => setEditing({ mode: 'closed' })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuFormModal({
  type,
  mode,
  item,
  onClose,
}: {
  type: 'MAIN_DISH' | 'DRINK';
  mode: 'add' | 'edit';
  item?: MenuItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [active, setActive] = useState(item?.active ?? true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertMenuItem({
        id: item?.id ?? null,
        type,
        name,
        description: description || null,
        order: item?.order ?? 0,
        active,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <h2 className="display-xl text-2xl">
          {mode === 'add' ? 'Nuevo' : 'Editar'} {type === 'MAIN_DISH' ? 'plato' : 'bebida'}
        </h2>

        <label className="block">
          <span className="text-sm text-ink-soft">Nombre</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mella-input mt-1"
          />
        </label>

        <label className="block">
          <span className="text-sm text-ink-soft">Descripción (opcional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mella-input mt-1"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4"
          />
          Visible para los invitados
        </label>

        {error && (
          <p className="text-sm text-terracotta-dark" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-ivory-50 rounded-3xl p-6 shadow-lift"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
