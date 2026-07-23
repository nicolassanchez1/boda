'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { bulkCreateInvitations } from '@/actions/admin';

type Result = {
  created: { token: string; guestName: string; cupos: number }[];
  failed: { line: string; reason: string }[];
};

export default function BulkCreateForm() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [lines, setLines] = useState(
    'Carlos e hijos, 3\nMamá Rosa, 1\nFamilia Pérez, 4',
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setError(null);
    setResult(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await bulkCreateInvitations({ lines });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data as Result);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-full bg-white border border-ink/15 text-sm hover:bg-ivory-100"
      >
        Crear varias
      </button>

      <AnimatePresence>
        {open && (
          <Modal onClose={close}>
            {!result ? (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="display-xl text-2xl">Crear varias invitaciones</h2>
                <p className="text-sm text-ink-soft">
                  Pega una línea por invitación con el formato{' '}
                  <code className="bg-ivory-100 px-1 rounded">Nombre, cupos</code>.
                </p>
                <textarea
                  required
                  value={lines}
                  onChange={(e) => setLines(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-ink/15 px-4 py-3 font-mono text-sm"
                />
                {error && (
                  <p className="text-sm text-terracotta-dark" role="alert">
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="px-4 py-2 rounded-full border border-ink/15"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="px-4 py-2 rounded-full bg-terracotta text-white disabled:opacity-50"
                  >
                    {pending ? 'Creando…' : 'Crear todas'}
                  </button>
                </div>
              </form>
            ) : (
              <BulkResult result={result} onClose={close} />
            )}
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function BulkResult({ result, onClose }: { result: Result; onClose: () => void }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  return (
    <div className="space-y-4">
      <h2 className="display-xl text-2xl">Resultado</h2>
      <p className="text-sm text-ink-soft">
        {result.created.length} creadas, {result.failed.length} con error.
      </p>
      {result.created.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-muted mb-2">Creadas</p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {result.created.map((c) => (
              <li key={c.token} className="text-sm flex items-center justify-between gap-2">
                <span className="truncate">
                  {c.guestName} · {c.cupos} {c.cupos === 1 ? 'cupo' : 'cupos'}
                </span>
                <a
                  href={`${base}/i/${c.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-terracotta-dark underline shrink-0"
                >
                  Abrir
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.failed.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-muted mb-2">No se pudieron crear</p>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {result.failed.map((f, i) => (
              <li key={i} className="text-xs text-ink-soft">
                <span className="font-mono">{f.line}</span> — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-full bg-terracotta text-white"
        >
          Cerrar
        </button>
      </div>
    </div>
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
