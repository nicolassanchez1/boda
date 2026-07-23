'use client';

import { useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { releaseGift, reserveGift } from '@/actions/guest';
import type { GiftData } from '@/app/i/[token]/GuestView';

type Props = {
  token: string;
  gifts: GiftData[];
  initiallyReservedIds: string[];
  isReadOnly: boolean;
};

export default function GiftSection({ token, gifts, initiallyReservedIds, isReadOnly }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Optimistic deltas layered on top of server truth (which arrives via props).
  // We track "mine" and "otherTaken" separately so a 409 on reserve can flip
  // a gift from optimistically-mine to optimistically-otherTaken cleanly.
  const [optMine, setOptMine] = useState<Set<string>>(new Set());
  const [optOtherTaken, setOptOtherTaken] = useState<Set<string>>(new Set());

  const view = useMemo(() => {
    return gifts.map((g) => {
      const serverMine = g.reservedByMe || initiallyReservedIds.includes(g.id);
      const mine = serverMine || optMine.has(g.id);
      // After release: serverMine=false but optMine might still hold it briefly.
      // The check `!optOtherTaken.has(g.id)` prevents mine from accidentally
      // turning back on after a 409 on release.
      const otherTaken = (!mine && (g.reservedByOther || optOtherTaken.has(g.id))) || false;
      return { ...g, mine, otherTaken };
    });
  }, [gifts, initiallyReservedIds, optMine, optOtherTaken]);

  const [confirming, setConfirming] = useState<GiftData | null>(null);
  const [releasing, setReleasing] = useState<GiftData | null>(null);

  const reserve = (gift: GiftData) =>
    startTransition(async () => {
      setError(null);
      setConfirming(null);
      setPendingId(gift.id);

      // Optimistic: it's mine now; if we had it optimistically marked as
      // other-taken, drop that flag.
      setOptMine((s) => new Set(s).add(gift.id));
      setOptOtherTaken((s) => {
        if (!s.has(gift.id)) return s;
        const n = new Set(s);
        n.delete(gift.id);
        return n;
      });

      const result = await reserveGift({ token, giftId: gift.id });
      setPendingId(null);

      if (!result.ok) {
        // Rollback mine; the gift is now taken by someone else (or by deadline).
        setOptMine((s) => {
          const n = new Set(s);
          n.delete(gift.id);
          return n;
        });
        if (result.code === 'CONFLICT') {
          setOptOtherTaken((s) => new Set(s).add(gift.id));
        }
        setError(messageFor(result.code));
        router.refresh();
        return;
      }

      // Success — server truth now reflects ours; clear the optimistic flag.
      setOptMine((s) => {
        const n = new Set(s);
        n.delete(gift.id);
        return n;
      });
      router.refresh();
    });

  const release = (gift: GiftData) =>
    startTransition(async () => {
      setError(null);
      setReleasing(null);
      setPendingId(gift.id);

      setOptMine((s) => {
        if (!s.has(gift.id)) return s;
        const n = new Set(s);
        n.delete(gift.id);
        return n;
      });

      const result = await releaseGift({ token, giftId: gift.id });
      setPendingId(null);

      if (!result.ok) {
        // Rollback — still ours.
        setOptMine((s) => new Set(s).add(gift.id));
        setError(messageFor(result.code));
        router.refresh();
        return;
      }

      router.refresh();
    });

  return (
    <section className="px-6 py-16 md:py-20 max-w-3xl mx-auto">
      <p className="eyebrow text-center mb-3">Lista de regalos</p>
      <h2 className="display-xl text-3xl md:text-4xl text-center mb-3">Si quieres tener un detalle</h2>
      <p className="text-ink-soft text-center max-w-md mx-auto mb-10">
        Estos son algunos regalos que nos harían mucha ilusión. Aparta el que prefieras y lo
        coordinamos después.
      </p>

      {error && (
        <div
          className="mb-6 mx-auto max-w-md text-center bg-terracotta/10 border border-terracotta/30 text-terracotta-dark rounded-xl px-4 py-3"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {view.map((g) => (
          <GiftCard
            key={g.id}
            gift={g}
            isMine={g.mine}
            otherTaken={g.otherTaken}
            isPending={pending && pendingId === g.id}
            isReadOnly={isReadOnly}
            onReserve={() => setConfirming(g)}
            onRelease={() => setReleasing(g)}
          />
        ))}
      </div>

      <ConfirmModal
        gift={confirming}
        pending={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && reserve(confirming)}
        title="¿Apartar este regalo?"
        body="Al confirmarlo, queda reservado a tu nombre. Podrás liberarlo más tarde si cambias de opinión."
        confirmLabel="Sí, apartar"
      />

      <ConfirmModal
        gift={releasing}
        pending={pending}
        onCancel={() => setReleasing(null)}
        onConfirm={() => releasing && release(releasing)}
        title="¿Liberar este regalo?"
        body="Volverá a estar disponible para los demás invitados."
        confirmLabel="Sí, liberar"
        tone="muted"
      />
    </section>
  );
}

function GiftCard({
  gift,
  isMine,
  otherTaken,
  isPending,
  isReadOnly,
  onReserve,
  onRelease,
}: {
  gift: GiftData;
  isMine: boolean;
  otherTaken: boolean;
  isPending: boolean;
  isReadOnly: boolean;
  onReserve: () => void;
  onRelease: () => void;
}) {
  const dim = otherTaken && !isMine;

  return (
    <motion.div
      layout
      transition={{ duration: 0.3 }}
      className={[
        'rounded-2xl bg-white shadow-soft overflow-hidden flex flex-col transition-opacity',
        dim ? 'opacity-50 grayscale' : '',
        isMine ? 'ring-2 ring-terracotta/40' : '',
      ].join(' ')}
    >
      {gift.imageUrl ? (
        <div className="relative aspect-square bg-ivory-100">
          <Image
            src={gift.imageUrl}
            alt={gift.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-ivory-100 to-ivory-200 flex items-center justify-center">
          <span className="display-xl text-5xl text-ink/20">🎁</span>
        </div>
      )}

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-display text-xl leading-tight">{gift.name}</h3>
        {gift.description && (
          <p className="text-sm text-ink-muted line-clamp-2">{gift.description}</p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          {isMine ? (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-terracotta bg-terracotta/10 px-2.5 py-1 rounded-full">
                Lo apartaste tú
              </span>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={onRelease}
                  disabled={isPending}
                  className="text-xs text-ink-muted underline underline-offset-2 px-2 py-1"
                >
                  Liberar
                </button>
              )}
            </>
          ) : otherTaken ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted bg-ink/10 px-2.5 py-1 rounded-full">
              Apartado
            </span>
          ) : (
            <>
              <span className="text-xs text-ink-muted">Disponible</span>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={onReserve}
                  disabled={isPending}
                  className="rounded-full bg-ink text-white text-sm px-4 py-2 hover:bg-ink-soft transition-colors disabled:opacity-50"
                >
                  {isPending ? '…' : 'Apartar'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ConfirmModal({
  gift,
  pending,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = 'primary',
}: {
  gift: GiftData | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'primary' | 'muted';
}) {
  return (
    <AnimatePresence>
      {gift && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40"
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-ivory-50 rounded-3xl p-6 shadow-lift"
          >
            <h3 id="confirm-title" className="display-xl text-2xl mb-2">
              {title}
            </h3>
            <p className="text-ink-soft mb-2">{body}</p>
            <p className="font-medium mb-6">{gift.name}</p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="px-5 py-3 rounded-full border border-ink/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className={[
                  'px-5 py-3 rounded-full font-medium transition-colors disabled:opacity-50',
                  tone === 'primary'
                    ? 'bg-terracotta text-white hover:bg-terracotta-dark'
                    : 'bg-ink text-white hover:bg-ink-soft',
                ].join(' ')}
              >
                {pending ? 'Guardando…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function messageFor(code: string): string {
  switch (code) {
    case 'CONFLICT':
      return 'Alguien acaba de apartar este regalo. Actualizamos la lista.';
    case 'DEADLINE_PASSED':
      return 'Ya pasó la fecha límite para apartar regalos.';
    case 'NOT_FOUND':
      return 'No encontramos tu invitación. Recarga la página.';
    default:
      return 'No pudimos completar la acción. Inténtalo de nuevo.';
  }
}
