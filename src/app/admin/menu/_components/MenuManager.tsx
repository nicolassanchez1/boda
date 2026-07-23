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
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <h2 className="display-xl text-2xl">{title}</h2>
        <button
          type="button"
          onClick={() => setEditing({ mode: 'add' })}
          className="px-4 py-2 rounded-full bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark"
        >
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
              <div className="flex flex-col items-end gap-1.5 text-xs shrink-0">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(it.id, -1)}
                    disabled={idx === 0 || pending}
                    className="w-8 h-8 rounded-full border border-ink/15 hover:bg-ivory-100 disabled:opacity-30"
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(it.id, 1)}
                    disabled={idx === items.length - 1 || pending}
                    className="w-8 h-8 rounded-full border border-ink/15 hover:bg-ivory-100 disabled:opacity-30"
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ mode: 'edit', item: it })}
                  className="px-3 py-1.5 rounded-full text-ink-muted underline underline-offset-2"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => remove(it)}
                  className="px-3 py-1.5 rounded-full text-terracotta-dark hover:bg-terracotta/10"
                >
                  Eliminar
                </button>
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
            className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm text-ink-soft">Descripción (opcional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
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

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-ink/15"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded-full bg-terracotta text-white disabled:opacity-50"
          >
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
