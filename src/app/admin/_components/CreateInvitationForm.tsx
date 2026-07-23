'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createInvitation } from '@/actions/admin';
import { buildInvitationLink } from '@/lib/format';

export default function CreateInvitationForm() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [guestName, setGuestName] = useState('');
  const [cupos, setCupos] = useState(1);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const reset = () => {
    setGuestName('');
    setCupos(1);
    setPhone('');
    setNotes('');
    setError(null);
    setCreatedLink(null);
  };

  const close = () => {
    if (pending) return;
    setOpen(false);
    setTimeout(reset, 200);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createInvitation({
        guestName,
        cupos,
        phone: phone || null,
        notes: notes || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const data = result.data as { token: string } | undefined;
      if (data?.token) {
        const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
        setCreatedLink(buildInvitationLink(base, data.token));
      }
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-full bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark"
      >
        Nueva invitación
      </button>

      <AnimatePresence>
        {open && (
          <Modal onClose={close}>
            {createdLink ? (
              <CreatedSuccess link={createdLink} onClose={close} />
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="display-xl text-2xl">Nueva invitación</h2>

                <label className="block">
                  <span className="text-sm text-ink-soft">Nombre del invitado o familia</span>
                  <input
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Carlos e hijos"
                    className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-ink-soft">Cupos (personas que cubre)</span>
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
                  <span className="text-sm text-ink-soft">Teléfono (opcional)</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 300 000 0000"
                    className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-ink-soft">Notas internas (opcional)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-ink/15 px-4 py-3"
                  />
                </label>

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
                    {pending ? 'Creando…' : 'Crear'}
                  </button>
                </div>
              </form>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function CreatedSuccess({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia este enlace:', link);
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="display-xl text-2xl">¡Listo!</h2>
      <p className="text-ink-soft">Comparte este enlace con el invitado:</p>
      <div className="flex items-center gap-2 bg-ivory-100 rounded-xl p-3">
        <code className="text-xs flex-1 break-all">{link}</code>
        <button
          type="button"
          onClick={copy}
          className="text-xs px-3 py-1.5 rounded-full bg-ink text-white"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
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
