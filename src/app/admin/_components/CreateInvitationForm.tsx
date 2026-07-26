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
        setCreatedLink(buildInvitationLink(base, data.token, guestName));
      }
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4" aria-hidden>
          <path d="M12 5 L12 19 M5 12 L19 12" />
        </svg>
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
                    className="mella-input mt-1"
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
                    className="mella-input mt-1"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-ink-soft">Teléfono (opcional)</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 300 000 0000"
                    className="mella-input mt-1"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-ink-soft">Notas internas (opcional)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mella-input mt-1"
                  />
                </label>

                {error && (
                  <p className="text-sm text-terracotta-dark" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                  <button type="button" onClick={close} disabled={pending} className="btn btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={pending} className="btn btn-primary">
                    {pending ? 'Creando…' : 'Crear invitación'}
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
      <div className="flex items-center gap-2 bg-ivory-100 rounded-xl p-2 pl-3">
        <code className="text-xs flex-1 break-all text-ink-soft">{link}</code>
        <button type="button" onClick={copy} className="btn btn-ink btn-sm shrink-0">
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className="btn btn-primary">
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
