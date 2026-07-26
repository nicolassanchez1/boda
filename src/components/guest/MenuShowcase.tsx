'use client';

// "Nuestro menú" — a visual showcase of the wedding food. Reads the menu from
// the database (managed in /admin/menu), so the couple controls every title and
// photo. Purely presentational; the per-guest choice happens in the RSVP food
// step. Renders nothing until the menu has items.

import { motion } from 'framer-motion';

type Dish = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
};

export default function MenuShowcase({
  mains,
  sides,
  drinks,
}: {
  mains: Dish[];
  sides: Dish[];
  drinks: Dish[];
}) {
  const isEmpty = mains.length === 0 && sides.length === 0 && drinks.length === 0;
  if (isEmpty) return null;

  return (
    <section
      aria-label="Nuestro menú"
      className="relative bg-ivory-100/50 border-y border-ink/5"
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <header className="text-center max-w-xl mx-auto mb-12 sm:mb-16">
          <p className="eyebrow text-terracotta">A la mesa</p>
          <h2 className="display-xl text-4xl sm:text-5xl md:text-6xl text-ink mt-2">
            Nuestro <em className="display-italic text-terracotta-dark">menú</em>
          </h2>
          <p className="text-ink-soft mt-4 leading-relaxed">
            Esto es lo que vamos a compartir contigo. Platos hechos por el chef,
            pensados para celebrar.
          </p>
          <div className="gold-rule w-28 mx-auto mt-7" />
        </header>

        <div className="space-y-14 sm:space-y-20">
          {mains.length > 0 && (
            <Category
              title="Plato fuerte"
              hint="Eliges uno al confirmar"
              items={mains}
              feature
            />
          )}
          {sides.length > 0 && (
            <Category title="Acompañamientos" hint="Para compartir en la mesa" items={sides} />
          )}
          {drinks.length > 0 && (
            <Category title="Bebidas" hint="Eliges una al confirmar" items={drinks} />
          )}
        </div>
      </div>
    </section>
  );
}

function Category({
  title,
  hint,
  items,
  feature = false,
}: {
  title: string;
  hint: string;
  items: Dish[];
  feature?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <span className="w-1.5 h-6 rounded-full bg-sage shrink-0" />
        <h3 className="display-xl text-2xl sm:text-3xl text-ink">{title}</h3>
        <span className="hidden sm:block flex-1 h-px bg-ink/10" />
        <span className="smallcaps text-ink-muted/80 shrink-0">{hint}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
        {items.map((d, i) => (
          <DishCard key={d.id} dish={d} index={i} feature={feature} />
        ))}
      </div>
    </div>
  );
}

function DishCard({
  dish,
  index,
  feature,
}: {
  dish: Dish;
  index: number;
  feature: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: (index % 2) * 0.08 }}
      className="card card-hover overflow-hidden flex flex-col"
    >
      <div className={['relative w-full overflow-hidden bg-ivory-100', feature ? 'aspect-[4/3]' : 'aspect-[3/2]'].join(' ')}>
        {dish.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dish.imageUrl}
            alt={dish.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-10 h-10 text-ink/15" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="M4 17 L9 12 L13 15 L16 12 L20 16" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        <h4 className="font-display text-xl sm:text-2xl text-ink leading-tight">
          {dish.name}
        </h4>
        {dish.description && (
          <p className="text-sm text-ink-soft leading-relaxed mt-2">{dish.description}</p>
        )}
      </div>
    </motion.article>
  );
}
