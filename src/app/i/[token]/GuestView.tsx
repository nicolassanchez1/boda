'use client';

// Guest experience as a guided 3-step flow (plus a decline path):
//   1. Bienvenida  → "¿Vas a asistir?"
//   2a. (NO)  → Mensaje de gracias            (FIN)
//   2b. (SÍ)  → Elige comida por persona    → 3
//   3.  Elige un regalo (opcional)
//
// Reads/writes through the existing server actions (confirmRsvp, reserveGift,
// releaseGift). Manages its own step state but always reflects what's persisted
// in the DB on initial render — so reloading keeps the guest on the right step.

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { confirmRsvp, releaseGift, reserveGift } from '@/actions/guest';
import GuestCinematic from '@/components/guest/GuestCinematic';

type AttendeeData = {
  id: string;
  name: string;
  mainDishId: string | null;
  drinkId: string | null;
  dietaryNotes: string | null;
};

type InvitationData = {
  token: string;
  guestName: string;
  cupos: number;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  attending: number | null;
  attendees: AttendeeData[];
  reservedGiftIds: string[];
};

type MenuItemData = { id: string; name: string; description: string | null };
type GiftData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  storeUrl: string | null;
  reservedByMe: boolean;
  reservedByOther: boolean;
};

type Step = 'welcome' | 'declined' | 'food' | 'gifts';

type Props = {
  invitation: InvitationData;
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
  gifts: GiftData[];
  weddingInfo: { date: string; time: string; venue: string };
  isReadOnly: boolean;
};

function pickInitialStep(inv: InvitationData, isReadOnly: boolean): Step {
  if (isReadOnly) return 'gifts'; // read-only falls through to a summary screen
  if (inv.status === 'DECLINED') return 'declined';
  if (inv.status === 'CONFIRMED' && inv.attendees.length > 0) return 'gifts';
  if (inv.status === 'CONFIRMED') return 'food';
  return 'welcome';
}

export default function GuestView({ invitation, menu, gifts, weddingInfo, isReadOnly }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => pickInitialStep(invitation, isReadOnly));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local override of "did you already reserve a gift" for optimistic UI.
  const [reservedIds, setReservedIds] = useState<Set<string>>(
    () => new Set(invitation.reservedGiftIds),
  );

  const fade = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <main className="min-h-screen">
      {/* Cinematic intro — 500vh of scroll-scrubbed frames + text overlays.
          Anchored id="rsvp-section" so the CTA can scroll the user into the form. */}
      <GuestCinematic
        guestName={invitation.guestName}
        cupos={invitation.cupos}
        weddingInfo={weddingInfo}
        rsvpAnchorId="rsvp-section"
      />

      <section
        id="rsvp-section"
        className="px-5 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24 max-w-2xl mx-auto"
      >
        {/* Brief connector so the transition from cinematic to form feels
            intentional rather than abrupt. */}
        <div className="text-center mb-8">
          <p className="eyebrow text-terracotta">Tu invitación</p>
          <p className="display-italic text-2xl text-ink mt-1">
            Hola, {invitation.guestName.split(',')[0]}
          </p>
        </div>

        <ProgressDots
          current={stepToProgress(step)}
          total={3}
          labels={['Asistencia', 'Comida', 'Regalo']}
        />

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div key="welcome" {...fade}>
              <WelcomeStep
                cupos={invitation.cupos}
                hasResponded={invitation.status !== 'PENDING'}
                previouslyConfirmed={invitation.status === 'CONFIRMED'}
                previouslyDeclined={invitation.status === 'DECLINED'}
                onAccept={() => setStep('food')}
                onDecline={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await confirmRsvp({
                      token: invitation.token,
                      status: 'DECLINED',
                      attending: 0,
                      attendees: [],
                    });
                    if (!result.ok) {
                      setError(rsvpMessageFor(result.code));
                      return;
                    }
                    setStep('declined');
                    router.refresh();
                  })
                }
                pending={pending}
                error={error}
              />
            </motion.div>
          )}

          {step === 'declined' && (
            <motion.div key="declined" {...fade}>
              <DeclinedStep
                guestName={invitation.guestName}
                onChangeMind={() => setStep('welcome')}
              />
            </motion.div>
          )}

          {step === 'food' && (
            <motion.div key="food" {...fade}>
              <FoodStep
                invitation={invitation}
                menu={menu}
                isReadOnly={isReadOnly}
                onSaved={() => {
                  setStep('gifts');
                  router.refresh();
                }}
                onBack={() => setStep('welcome')}
                onError={setError}
                pending={pending}
              />
            </motion.div>
          )}

          {step === 'gifts' && (
            <motion.div key="gifts" {...fade}>
              <GiftsStep
                token={invitation.token}
                gifts={gifts}
                reservedIds={reservedIds}
                setReservedIds={setReservedIds}
                isReadOnly={isReadOnly}
                onEditFood={() => setStep('food')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer className="py-10 text-center text-ink-muted/70 text-xs">
        <p>Con todo nuestro cariño.</p>
      </footer>
    </main>
  );
}

// -----------------------------------------------------------------------------
// Hero
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Progress dots
// -----------------------------------------------------------------------------

function stepToProgress(step: Step): number {
  if (step === 'welcome') return 0;
  if (step === 'food') return 1;
  if (step === 'gifts') return 2;
  return 0; // declined has no progress
}

function ProgressDots({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10" aria-label="Progreso">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={[
                'w-2 h-2 rounded-full transition-all duration-300',
                done
                  ? 'bg-terracotta w-6'
                  : active
                  ? 'bg-terracotta'
                  : 'bg-ink/20',
              ].join(' ')}
            />
            {i < total - 1 && (
              <span className={['w-4 h-px transition-colors', done ? 'bg-terracotta' : 'bg-ink/15'].join(' ')} />
            )}
          </div>
        );
      })}
      <span className="sr-only">{labels[current]}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 1: Welcome — ask if they'll attend
// -----------------------------------------------------------------------------

function WelcomeStep({
  cupos,
  hasResponded,
  previouslyConfirmed,
  previouslyDeclined,
  onAccept,
  onDecline,
  pending,
  error,
}: {
  cupos: number;
  hasResponded: boolean;
  previouslyConfirmed: boolean;
  previouslyDeclined: boolean;
  onAccept: () => void;
  onDecline: () => void;
  pending: boolean;
  error: string | null;
}) {
  if (hasResponded) {
    // Already responded — show current state + offer to change
    return (
      <div className="space-y-5">
        <div className="text-center">
          <p className="display-italic text-2xl text-ink">
            {previouslyConfirmed ? '¡Genial, ahí estaremos!' : 'Gracias por avisarnos'}
          </p>
          <p className="text-sm text-ink-muted mt-2">
            {previouslyConfirmed
              ? 'Tu respuesta ya está guardada.'
              : 'Tu respuesta ya está guardada.'}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-soft p-5 text-sm text-ink-soft">
          <p className="font-medium text-ink mb-1">¿Quieres cambiar tu respuesta?</p>
          <p className="text-ink-muted">
            Si te equivocaste o tus planes cambiaron, podes actualizarla acá.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onAccept}
              disabled={pending}
              className="cursor-pointer flex-1 px-4 py-3 rounded-full bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
            >
              {previouslyConfirmed ? 'Editar comida' : 'Sí, ahí estaré'}
            </button>
            <button
              type="button"
              onClick={onDecline}
              disabled={pending}
              className="cursor-pointer flex-1 px-4 py-3 rounded-full border border-ink/15 text-ink text-sm hover:bg-ivory-100 transition-colors disabled:opacity-50"
            >
              {previouslyDeclined ? 'Sí, ahora sí' : 'No podré ir'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // First-time visitor — clean prompt
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="display-italic text-2xl text-ink">
          ¿Nos acompañarás?
        </p>
        <p className="text-sm text-ink-muted mt-2 max-w-md mx-auto">
          {cupos === 1
            ? 'Tu invitación es para 1 persona.'
            : `Tu invitación es para ${cupos} personas.`}
          {' '}No podemos agregar cupos extra, pero podés decirnos cuántos de los tuyos vendrán.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onAccept}
          disabled={pending}
          className="cursor-pointer px-6 py-5 rounded-2xl bg-terracotta text-white font-medium text-lg shadow-soft hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          ¡Sí, ahí estaré!
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={pending}
          className="cursor-pointer px-6 py-5 rounded-2xl bg-white border border-ink/15 text-ink font-medium text-lg hover:bg-ivory-100 transition-colors disabled:opacity-50"
        >
          No podré ir
        </button>
      </div>

      {error && (
        <p className="text-sm text-terracotta-dark text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 2a: Declined — thank you
// -----------------------------------------------------------------------------

function DeclinedStep({
  guestName,
  onChangeMind,
}: {
  guestName: string;
  onChangeMind: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <p className="display-italic text-3xl sm:text-4xl text-ink">
        Gracias por avisarnos
      </p>
      <p className="text-ink-soft max-w-md mx-auto">
        {guestName}, vamos a extrañarte, pero esperamos celebrarlo contigo en otra ocasión. 💛
      </p>
      <button
        type="button"
        onClick={onChangeMind}
        className="cursor-pointer text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        Cambié de opinión, sí voy a poder ir
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 2b: Food — stepper + attendee editor
// -----------------------------------------------------------------------------

function FoodStep({
  invitation,
  menu,
  isReadOnly,
  onSaved,
  onBack,
  onError,
  pending,
}: {
  invitation: InvitationData;
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
  isReadOnly: boolean;
  onSaved: () => void;
  onBack: () => void;
  onError: (msg: string) => void;
  pending: boolean;
}) {
  const [attending, setAttending] = useState<number>(
    Math.max(1, invitation.attendees.length || 1),
  );
  const [attendees, setAttendees] = useState<AttendeeData[]>(() =>
    padAttendees(invitation.attendees, attending),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();

  const setCount = (n: number) => {
    const clamped = Math.max(1, Math.min(invitation.cupos, n));
    setAttending(clamped);
    setAttendees((prev) => resizeAttendees(prev, clamped));
  };

  const updateAttendee = (idx: number, patch: Partial<AttendeeData>) => {
    setAttendees((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await confirmRsvp({
        token: invitation.token,
        status: 'CONFIRMED',
        attending,
        attendees: attendees.slice(0, attending).map((a) => ({
          id: a.id,
          name: a.name,
          mainDishId: a.mainDishId,
          drinkId: a.drinkId,
          dietaryNotes: a.dietaryNotes,
        })),
      });
      if (!result.ok) {
        const msg = rsvpMessageFor(result.code);
        setError(msg);
        onError(msg);
        return;
      }
      onSaved();
    });

  if (isReadOnly) {
    return (
      <div className="space-y-6">
        <div>
          <p className="display-italic text-2xl text-ink mb-2">Comida confirmada</p>
          <p className="text-sm text-ink-muted">
            Estos son los platos que elegiste:
          </p>
        </div>
        {invitation.attendees.length === 0 ? (
          <p className="text-ink-muted italic">No completaste la elección de comida.</p>
        ) : (
          <ul className="space-y-3">
            {invitation.attendees.map((a) => (
              <li key={a.id} className="bg-white rounded-2xl shadow-soft p-4">
                <p className="font-display text-lg">{a.name}</p>
                <p className="text-sm text-ink-muted">
                  {dishName(menu.mainDishes, a.mainDishId) ?? 'Sin plato'}
                  {' · '}
                  {dishName(menu.drinks, a.drinkId) ?? 'Sin bebida'}
                </p>
                {a.dietaryNotes && (
                  <p className="text-xs text-ink-muted italic mt-1">"{a.dietaryNotes}"</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="display-italic text-2xl text-ink">¡Qué alegría!</p>
        <p className="text-sm text-ink-muted mt-2">
          Elige cuántos de tus {invitation.cupos} {invitation.cupos === 1 ? 'cupo' : 'cupos'} vienen, y llena los datos de cada uno.
        </p>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setCount(attending - 1)}
          disabled={attending <= 1}
          aria-label="Una persona menos"
          className="cursor-pointer w-12 h-12 rounded-full border border-ink/20 bg-white text-2xl disabled:opacity-30 transition-colors hover:bg-ivory-100"
        >
          −
        </button>
        <div className="text-center">
          <div className="display-xl text-4xl">{attending}</div>
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            {attending === 1 ? 'persona' : 'personas'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCount(attending + 1)}
          disabled={attending >= invitation.cupos}
          aria-label="Una persona más"
          className="cursor-pointer w-12 h-12 rounded-full border border-ink/20 bg-white text-2xl disabled:opacity-30 transition-colors hover:bg-ivory-100"
        >
          +
        </button>
      </div>

      <div className="space-y-4">
        {attendees.slice(0, attending).map((a, idx) => (
          <AttendeeEditor
            key={idx}
            index={idx + 1}
            attendee={a}
            menu={menu}
            onChange={(patch) => updateAttendee(idx, patch)}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-terracotta-dark text-center" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="cursor-pointer px-5 py-3 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || attendees.slice(0, attending).some((a) => !a.name.trim())}
          className="cursor-pointer flex-1 px-5 py-3 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

function AttendeeEditor({
  index,
  attendee,
  menu,
  onChange,
}: {
  index: number;
  attendee: AttendeeData;
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
  onChange: (patch: Partial<AttendeeData>) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5">
      <p className="eyebrow text-terracotta mb-3">Persona {index}</p>

      <label className="block mb-3">
        <span className="text-sm text-ink-soft">Nombre completo</span>
        <input
          type="text"
          value={attendee.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Como figura en tu invitación"
          className="mt-1 w-full rounded-xl border border-ink/15 bg-ivory-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-ink-soft">Plato principal</span>
          <select
            value={attendee.mainDishId ?? ''}
            onChange={(e) => onChange({ mainDishId: e.target.value || null })}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-ivory-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          >
            <option value="">— Elige un plato —</option>
            {menu.mainDishes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-ink-soft">Bebida</span>
          <select
            value={attendee.drinkId ?? ''}
            onChange={(e) => onChange({ drinkId: e.target.value || null })}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-ivory-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          >
            <option value="">— Elige una bebida —</option>
            {menu.drinks.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block mt-3">
        <span className="text-sm text-ink-soft">
          Notas dietéticas <span className="text-ink-muted/70 text-xs">opcional</span>
        </span>
        <input
          type="text"
          value={attendee.dietaryNotes ?? ''}
          onChange={(e) => onChange({ dietaryNotes: e.target.value || null })}
          placeholder="Alergias, vegetariano, etc."
          maxLength={500}
          className="mt-1 w-full rounded-xl border border-ink/15 bg-ivory-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        />
      </label>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 3: Gifts
// -----------------------------------------------------------------------------

function GiftsStep({
  token,
  gifts,
  reservedIds,
  setReservedIds,
  isReadOnly,
  onEditFood,
}: {
  token: string;
  gifts: GiftData[];
  reservedIds: Set<string>;
  setReservedIds: (s: Set<string>) => void;
  isReadOnly: boolean;
  onEditFood: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<GiftData | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const mine = gifts.filter((g) => reservedIds.has(g.id));
  const others = gifts.filter((g) => !reservedIds.has(g.id));

  const reserve = (gift: GiftData) =>
    startTransition(async () => {
      setHint(null);
      const result = await reserveGift({ token, giftId: gift.id });
      if (!result.ok) {
        setHint(messageFor(result.code));
        return;
      }
      setReservedIds(new Set([...reservedIds, gift.id]));
      setConfirming(null);
    });

  const release = (gift: GiftData) =>
    startTransition(async () => {
      setHint(null);
      const result = await releaseGift({ token, giftId: gift.id });
      if (!result.ok) {
        setHint(messageFor(result.code));
        return;
      }
      const next = new Set(reservedIds);
      next.delete(gift.id);
      setReservedIds(next);
    });

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="display-italic text-2xl text-ink">Si quieres tener un detalle</p>
        <p className="text-sm text-ink-muted mt-2">
          Estos son algunos regalos que nos harían mucha ilusión. Aparta el que prefieras.
          {' '}
          <em className="not-italic">Es completamente opcional.</em>
        </p>
      </div>

      {hint && (
        <p className="text-sm text-terracotta-dark text-center" role="alert">
          {hint}
        </p>
      )}

      {mine.length > 0 && (
        <div className="space-y-3">
          <p className="smallcaps text-sage-dark">Lo apartaste tú</p>
          {mine.map((g) => (
            <GiftRow
              key={g.id}
              gift={g}
              mine
              pending={pending}
              onAction={isReadOnly ? undefined : () => release(g)}
              actionLabel="Liberar"
            />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-3">
          <p className={mine.length > 0 ? 'smallcaps text-ink-muted pt-2' : 'smallcaps text-ink-muted'}>
            Disponibles
          </p>
          {others.map((g) => (
            <GiftRow
              key={g.id}
              gift={g}
              mine={false}
              pending={pending}
              onAction={isReadOnly ? undefined : () => setConfirming(g)}
              actionLabel="Apartar"
            />
          ))}
        </div>
      )}

      {gifts.length === 0 && (
        <p className="text-sm text-ink-muted text-center italic">
          La lista de regalos aún no está publicada.
        </p>
      )}

      {!isReadOnly && mine.length > 0 && (
        <button
          type="button"
          onClick={onEditFood}
          className="cursor-pointer mx-auto block text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          Cambiar mi comida o respuesta
        </button>
      )}

      <AnimatePresence>
        {confirming && (
          <ConfirmModal
            gift={confirming}
            pending={pending}
            onCancel={() => setConfirming(null)}
            onConfirm={() => reserve(confirming)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GiftRow({
  gift,
  mine,
  pending,
  onAction,
  actionLabel,
}: {
  gift: GiftData;
  mine: boolean;
  pending: boolean;
  onAction?: () => void;
  actionLabel: string;
}) {
  return (
    <div
      className={[
        'bg-white rounded-2xl shadow-soft p-3 sm:p-4 flex items-center gap-3 sm:gap-4',
        mine ? 'ring-2 ring-sage/40' : '',
      ].join(' ')}
    >
      {gift.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gift.imageUrl}
          alt={gift.name}
          loading="lazy"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-ivory-100 shrink-0"
        />
      ) : (
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-ivory-100 flex items-center justify-center text-xl shrink-0">
          🎁
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink truncate">{gift.name}</p>
        {gift.description && (
          <p className="text-xs text-ink-muted truncate">{gift.description}</p>
        )}
        {mine && (
          <p className="text-xs text-sage-dark mt-1">Lo apartaste tú</p>
        )}
      </div>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={pending}
          className={[
            'cursor-pointer shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50',
            mine
              ? 'border border-ink/15 hover:bg-ivory-100'
              : 'bg-ink text-white hover:bg-ink-soft',
          ].join(' ')}
        >
          {pending ? '…' : actionLabel}
        </button>
      )}
    </div>
  );
}

function ConfirmModal({
  gift,
  pending,
  onCancel,
  onConfirm,
}: {
  gift: GiftData;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40"
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
        className="w-full max-w-md bg-ivory-50 rounded-3xl p-6 shadow-lift"
      >
        <h3 className="display-xl text-2xl mb-2">¿Apartar este regalo?</h3>
        <p className="text-ink-soft mb-1">{gift.name}</p>
        {gift.description && <p className="text-sm text-ink-muted mb-4">{gift.description}</p>}
        <p className="text-xs text-ink-muted mb-6">
          Quedará reservado a tu nombre. Podrás liberarlo más tarde si cambias de idea.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="cursor-pointer px-5 py-2.5 rounded-full border border-ink/15 hover:bg-ivory-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="cursor-pointer px-5 py-2.5 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
          >
            {pending ? 'Apartando…' : 'Sí, apartar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function padAttendees(existing: AttendeeData[], count: number): AttendeeData[] {
  const out: AttendeeData[] = existing.slice(0, count).map((a) => ({ ...a }));
  while (out.length < count) {
    out.push({
      id: '',
      name: '',
      mainDishId: null,
      drinkId: null,
      dietaryNotes: null,
    });
  }
  return out;
}

function resizeAttendees(prev: AttendeeData[], next: number): AttendeeData[] {
  if (prev.length === next) return prev;
  if (prev.length > next) return prev.slice(0, next);
  return [...prev, ...Array.from({ length: next - prev.length }, () => ({
    id: '',
    name: '',
    mainDishId: null,
    drinkId: null,
    dietaryNotes: null,
  }))];
}

function dishName(items: MenuItemData[], id: string | null): string | null {
  if (!id) return null;
  return items.find((i) => i.id === id)?.name ?? null;
}

function messageFor(code: string): string {
  switch (code) {
    case 'CONFLICT':
      return 'Alguien acaba de apartar este regalo. Actualizá la lista.';
    case 'DEADLINE_PASSED':
      return 'Ya pasó la fecha límite para apartar regalos.';
    case 'NOT_FOUND':
      return 'No encontramos esta invitación. Recargá la página.';
    default:
      return 'No pudimos guardar. Intentá de nuevo.';
  }
}

function rsvpMessageFor(code: string): string {
  switch (code) {
    case 'OVER_CAP':
      return 'No podés confirmar más personas de las que cubre tu invitación.';
    case 'COUNT_MISMATCH':
      return 'El número de asistentes no coincide con los datos que llenaste.';
    case 'INVALID':
      return 'Revisá los datos del formulario e intentá de nuevo.';
    case 'DEADLINE_PASSED':
      return 'Ya pasó la fecha límite para confirmar.';
    case 'NOT_FOUND':
      return 'No encontramos esta invitación. Recargá la página.';
    default:
      return 'No pudimos guardar tu respuesta. Intentá de nuevo.';
  }
}
