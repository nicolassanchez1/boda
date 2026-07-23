'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { confirmRsvp } from '@/actions/guest';
import type { InvitationData, MenuItemData } from '@/app/i/[token]/GuestView';

type Props = {
  invitation: InvitationData;
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
  isReadOnly: boolean;
};

type AttendeeDraft = {
  name: string;
  mainDishId: string;
  drinkId: string;
  dietaryNotes: string;
};

type Mode = 'pick' | 'editing' | 'confirmed' | 'declined';

export default function RsvpSection({ invitation, menu, isReadOnly }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialMode: Mode =
    invitation.status === 'CONFIRMED'
      ? 'confirmed'
      : invitation.status === 'DECLINED'
      ? 'declined'
      : 'pick';

  const [mode, setMode] = useState<Mode>(initialMode);

  const [attending, setAttending] = useState<number>(
    Math.max(1, invitation.attending ?? Math.min(1, invitation.cupos)),
  );
  const [attendees, setAttendees] = useState<AttendeeDraft[]>(
    padAttendees(invitation.attendees, attending, menu),
  );

  const setCount = (n: number) => {
    const clamped = Math.max(1, Math.min(invitation.cupos, n));
    setAttending(clamped);
    setAttendees((prev) => resizeAttendees(prev, clamped, menu));
  };

  const updateAttendee = (idx: number, patch: Partial<AttendeeDraft>) => {
    setAttendees((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const submitConfirmed = () =>
    startTransition(async () => {
      setError(null);
      const result = await confirmRsvp({
        token: invitation.token,
        status: 'CONFIRMED',
        attending,
        attendees: attendees.slice(0, attending).map((a) => ({
          name: a.name,
          mainDishId: a.mainDishId || null,
          drinkId: a.drinkId || null,
          dietaryNotes: a.dietaryNotes || null,
        })),
      });
      if (!result.ok) {
        setError(messageFor(result.code));
        return;
      }
      setMode('confirmed');
      router.refresh();
    });

  const submitDeclined = () =>
    startTransition(async () => {
      setError(null);
      const result = await confirmRsvp({
        token: invitation.token,
        status: 'DECLINED',
        attending: 0,
        attendees: [],
      });
      if (!result.ok) {
        setError(messageFor(result.code));
        return;
      }
      setMode('declined');
      router.refresh();
    });

  const startEditing = () => {
    setError(null);
    setMode('editing');
  };

  const goBackToPick = () => {
    setError(null);
    setMode('pick');
  };

  // ---------- Read-only (after deadline) ----------
  if (isReadOnly) {
    return (
      <section className="px-6 py-16 md:py-20 max-w-2xl mx-auto">
        <SectionHeading title="Confirmación de asistencia" />
        <h2 className="display-xl text-3xl md:text-4xl text-center mb-4">
          El plazo para confirmar ya cerró
        </h2>
        <p className="text-ink-soft text-center max-w-md mx-auto">
          Si necesitas un cambio de último momento, escríbenos por WhatsApp y lo vemos
          personalmente.
        </p>
        <ReadOnlySummary invitation={invitation} menu={menu} />
      </section>
    );
  }

  // ---------- Confirmed summary ----------
  if (mode === 'confirmed') {
    return (
      <section className="px-6 py-16 md:py-20 max-w-2xl mx-auto">
        <SectionHeading title="Confirmación de asistencia" />
        <h2 className="display-xl text-3xl md:text-4xl text-center mb-3">¡Qué alegría!</h2>
        <p className="text-ink-soft text-center mb-8">
          {invitation.attending ?? attending}{' '}
          {(invitation.attending ?? attending) === 1 ? 'persona confirmada' : 'personas confirmadas'}.
        </p>
        <ConfirmedSummary
          attendees={attendees.slice(0, invitation.attending ?? attending)}
          menu={menu}
        />
        <div className="text-center mt-8">
          <button type="button" onClick={startEditing} className="text-terracotta underline underline-offset-4 px-4 py-2">
            Quiero cambiar algo
          </button>
        </div>
      </section>
    );
  }

  // ---------- Declined summary ----------
  if (mode === 'declined') {
    return (
      <section className="px-6 py-16 md:py-20 max-w-2xl mx-auto">
        <SectionHeading title="Confirmación de asistencia" />
        <h2 className="display-xl text-3xl md:text-4xl text-center mb-3">Gracias por avisarnos</h2>
        <p className="text-ink-soft text-center mb-8 max-w-md mx-auto">
          Vamos a extrañarte, pero esperamos celebrarlo contigo en otra ocasión.
        </p>
        <div className="text-center">
          <button
            type="button"
            onClick={goBackToPick}
            className="text-terracotta underline underline-offset-4 px-4 py-2"
          >
            Cambiar mi respuesta
          </button>
        </div>
      </section>
    );
  }

  // ---------- Pick (or editing) ----------
  return (
    <section className="px-6 py-16 md:py-20 max-w-2xl mx-auto">
      <SectionHeading title="Confirmación de asistencia" />

      {mode === 'pick' && (
        <>
          <h2 className="display-xl text-3xl md:text-4xl text-center mb-4">¿Nos acompañarás?</h2>
          <p className="text-ink-soft text-center mb-10 max-w-md mx-auto">
            Tu invitación es para {invitation.cupos}{' '}
            {invitation.cupos === 1 ? 'persona' : 'personas'}. No podemos agregar cupos extra, pero
            cuéntanos cuántos de los tuyos vendrán.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setCount(Math.max(1, Math.min(invitation.cupos, attending || 1)));
                setMode('editing');
              }}
              className="rounded-2xl bg-terracotta text-white py-5 px-6 font-medium text-lg shadow-soft hover:bg-terracotta-dark transition-colors disabled:opacity-50"
            >
              ¡Ahí estaremos!
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={submitDeclined}
              className="rounded-2xl bg-white border border-ink/15 text-ink py-5 px-6 font-medium text-lg hover:bg-ivory-100 transition-colors disabled:opacity-50"
            >
              No podremos asistir
            </button>
          </div>
        </>
      )}

      {mode === 'editing' && (
        <>
          <h2 className="display-xl text-3xl md:text-4xl text-center mb-3">Cuéntanos más</h2>
          <p className="text-ink-soft text-center mb-8 max-w-md mx-auto">
            Elige cuántos de tus {invitation.cupos} cupos vienen, y llena los datos de cada uno.
          </p>

          <div className="flex items-center justify-center gap-6 mb-8">
            <button
              type="button"
              onClick={() => setCount(attending - 1)}
              disabled={attending <= 1}
              aria-label="Una persona menos"
              className="w-12 h-12 rounded-full border border-ink/20 bg-white text-2xl disabled:opacity-30"
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
              className="w-12 h-12 rounded-full border border-ink/20 bg-white text-2xl disabled:opacity-30"
            >
              +
            </button>
          </div>

          <div className="space-y-6">
            {attendees.slice(0, attending).map((a, idx) => (
              <AttendeeCard
                key={idx}
                index={idx + 1}
                attendee={a}
                menu={menu}
                onChange={(patch) => updateAttendee(idx, patch)}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-terracotta-dark mt-6" role="alert">
              {error}
            </p>
          )}

          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:justify-center">
            <button
              type="button"
              onClick={goBackToPick}
              className="px-6 py-3 rounded-full border border-ink/15 text-ink"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={submitConfirmed}
              disabled={pending || attendees.slice(0, attending).some((a) => !a.name.trim())}
              className="px-6 py-3 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Subcomponents ----------------------------------------------------

function SectionHeading({ title }: { title: string }) {
  return <p className="eyebrow text-center mb-3">{title}</p>;
}

function AttendeeCard({
  index,
  attendee,
  menu,
  onChange,
}: {
  index: number;
  attendee: AttendeeDraft;
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
  onChange: (patch: Partial<AttendeeDraft>) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white/70 rounded-2xl p-5 shadow-soft"
    >
      <p className="eyebrow mb-3">Persona {index}</p>

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
            value={attendee.mainDishId}
            onChange={(e) => onChange({ mainDishId: e.target.value })}
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
            value={attendee.drinkId}
            onChange={(e) => onChange({ drinkId: e.target.value })}
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
          Notas dietéticas <span className="text-ink-muted">(opcional)</span>
        </span>
        <input
          type="text"
          value={attendee.dietaryNotes}
          onChange={(e) => onChange({ dietaryNotes: e.target.value })}
          placeholder="Alergias, vegetariano, etc."
          maxLength={500}
          className="mt-1 w-full rounded-xl border border-ink/15 bg-ivory-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        />
      </label>
    </motion.div>
  );
}

function ConfirmedSummary({
  attendees,
  menu,
}: {
  attendees: AttendeeDraft[];
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
}) {
  return (
    <div className="bg-white/60 rounded-2xl p-6 shadow-soft">
      <ul className="divide-y divide-ink/10">
        {attendees.map((a, i) => (
          <li key={i} className="py-3 flex flex-col gap-1">
            <span className="font-medium">{a.name}</span>
            <span className="text-sm text-ink-muted">
              {dishName(menu.mainDishes, a.mainDishId) ?? 'Sin plato'} ·{' '}
              {dishName(menu.drinks, a.drinkId) ?? 'Sin bebida'}
            </span>
            {a.dietaryNotes && (
              <span className="text-xs text-ink-muted italic">"{a.dietaryNotes}"</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReadOnlySummary({
  invitation,
  menu,
}: {
  invitation: InvitationData;
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
}) {
  if (invitation.status === 'PENDING') {
    return (
      <p className="text-center text-ink-muted italic mt-8">
        No alcanzaste a confirmar. Si vienes, preséntate el día del evento.
      </p>
    );
  }
  if (invitation.status === 'DECLINED') {
    return (
      <p className="text-center text-ink-muted italic mt-8">Marcaste que no podrás asistir.</p>
    );
  }
  return (
    <div className="bg-white/60 rounded-2xl p-6 shadow-soft max-w-md mx-auto mt-8">
      <ul className="space-y-3">
        {invitation.attendees.map((a) => (
          <li key={a.id} className="flex flex-col">
            <span className="font-medium">{a.name}</span>
            <span className="text-sm text-ink-muted">
              {dishName(menu.mainDishes, a.mainDishId) ?? 'Sin plato'} ·{' '}
              {dishName(menu.drinks, a.drinkId) ?? 'Sin bebida'}
            </span>
            {a.dietaryNotes && (
              <span className="text-xs text-ink-muted italic">"{a.dietaryNotes}"</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Helpers ----------------------------------------------------------

function emptyDraft(): AttendeeDraft {
  return { name: '', mainDishId: '', drinkId: '', dietaryNotes: '' };
}

function padAttendees(
  existing: InvitationData['attendees'],
  count: number,
  _menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] },
): AttendeeDraft[] {
  const out: AttendeeDraft[] = existing.slice(0, count).map((a) => ({
    name: a.name,
    mainDishId: a.mainDishId ?? '',
    drinkId: a.drinkId ?? '',
    dietaryNotes: a.dietaryNotes ?? '',
  }));
  while (out.length < count) out.push(emptyDraft());
  return out;
}

function resizeAttendees(
  prev: AttendeeDraft[],
  next: number,
  _menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] },
): AttendeeDraft[] {
  if (prev.length === next) return prev;
  if (prev.length > next) return prev.slice(0, next);
  return [...prev, ...Array.from({ length: next - prev.length }, () => emptyDraft())];
}

function dishName(items: MenuItemData[], id: string | null | ''): string | null {
  if (!id) return null;
  return items.find((i) => i.id === id)?.name ?? null;
}

function messageFor(code: string): string {
  switch (code) {
    case 'OVER_CAP':
      return 'No puedes confirmar más personas de las que cubre tu invitación.';
    case 'COUNT_MISMATCH':
      return 'Verifica que el número de asistentes coincida con los datos que llenaste.';
    case 'DEADLINE_PASSED':
      return 'El plazo para confirmar ya cerró. Escríbenos por WhatsApp si necesitas un cambio.';
    case 'NOT_FOUND':
      return 'No encontramos tu invitación. Recarga la página.';
    default:
      return 'No pudimos guardar tu respuesta. Inténtalo de nuevo.';
  }
}
