'use client';

import { motion } from 'framer-motion';
import RsvpSection from '@/components/guest/RsvpSection';
import GiftSection from '@/components/guest/GiftSection';

export type AttendeeData = {
  id: string;
  name: string;
  mainDishId: string | null;
  drinkId: string | null;
  dietaryNotes: string | null;
};

export type InvitationData = {
  token: string;
  guestName: string;
  cupos: number;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  attending: number | null;
  attendees: AttendeeData[];
  reservedGiftIds: string[];
};

export type MenuItemData = { id: string; name: string; description: string | null };
export type GiftData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  storeUrl: string | null;
  reservedByMe: boolean;
  reservedByOther: boolean;
};

type Props = {
  invitation: InvitationData;
  menu: { mainDishes: MenuItemData[]; drinks: MenuItemData[] };
  gifts: GiftData[];
  weddingInfo: { date: string; time: string; venue: string };
  isReadOnly: boolean;
};

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

export default function GuestView({ invitation, menu, gifts, weddingInfo, isReadOnly }: Props) {
  const { guestName, cupos } = invitation;

  return (
    <main className="min-h-screen">
      {/* --- Bienvenida --- */}
      <section className="px-6 pt-16 pb-20 md:pt-24 md:pb-28 max-w-2xl mx-auto text-center">
        <motion.p {...fadeIn} className="eyebrow mb-6">
          Nuestra boda
        </motion.p>

        <motion.h1
          {...fadeIn}
          transition={{ ...fadeIn.transition, delay: 0.05 }}
          className="display-xl text-5xl md:text-6xl mb-6"
        >
          {greetingFor(guestName)}
        </motion.h1>

        <motion.p
          {...fadeIn}
          transition={{ ...fadeIn.transition, delay: 0.1 }}
          className="text-ink-soft text-lg leading-relaxed mb-10"
        >
          {weddingInfo.date ? <>Nos encantaría que nos acompañes el </> : <>Nos encantaría que nos acompañes</>}
          <br className="hidden sm:block" />
          {weddingInfo.date ? (
            <strong className="text-ink font-medium">{weddingInfo.date}</strong>
          ) : null}
          {weddingInfo.time ? <>, a las {weddingInfo.time}</> : null}
          {weddingInfo.venue ? (
            <>
              {' '}
              · <span className="text-ink">{weddingInfo.venue}</span>
            </>
          ) : null}
          .
        </motion.p>

        <motion.div
          {...fadeIn}
          transition={{ ...fadeIn.transition, delay: 0.15 }}
          className="inline-flex flex-col items-center gap-2 px-8 py-6 rounded-2xl bg-white/60 backdrop-blur shadow-soft"
        >
          <span className="eyebrow">Tu invitación</span>
          <span className="display-xl text-3xl">
            {cupos} {cupos === 1 ? 'cupo' : 'cupos'}
          </span>
          <span className="text-ink-muted text-sm">
            {cupos === 1
              ? 'Tu invitación es para 1 persona.'
              : `Tu invitación es para ${cupos} personas.`}
          </span>
        </motion.div>
      </section>

      <div className="hairline max-w-md mx-auto" />

      {/* --- Confirmación --- */}
      <RsvpSection
        invitation={invitation}
        menu={menu}
        isReadOnly={isReadOnly}
      />

      <div className="hairline max-w-md mx-auto" />

      {/* --- Regalos --- */}
      <GiftSection
        token={invitation.token}
        gifts={gifts}
        initiallyReservedIds={invitation.reservedGiftIds}
        isReadOnly={isReadOnly}
      />

      <footer className="py-12 text-center text-ink-muted text-sm">
        <p>Con todo nuestro cariño.</p>
      </footer>
    </main>
  );
}

function greetingFor(guestName: string): string {
  // Lightweight personalization. We don't try to be clever with surnames here —
  // the admin decides what to put in guestName (e.g. "Familia Pérez" or "Carlos").
  return `Hola, ${guestName}`;
}
