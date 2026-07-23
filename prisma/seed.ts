// Seeds the gift list idempotently WITHOUT deleting or modifying any existing rows.
//
// Contract:
//   - Never calls deleteMany.
//   - Never updates an existing gift (reservation, order, active flag) — even if it
//     happens to share a name with one in the seed list. If a row with that name
//     already exists, it is left exactly as it is.
//   - Only inserts rows that don't already exist (by name).
//   - The placeholder invitation ("Apartado previamente") is upserted — its
//     existing row, if any, is never overwritten.
//
// Safe to run against a database that's shared with another project: rows that
// aren't ours stay untouched, and rows that are ours get filled in if missing.
//
// Usage:  npm run db:seed

import { PrismaClient, RsvpStatus } from '@prisma/client';

const prisma = new PrismaClient();

const AVAILABLE_GIFTS: string[] = [
  'Air fryer',
  'Vajilla',
  'Olla arrocera',
  'Cubiertos',
  'Limpiones',
  'Recogedor',
  'Set de utensilios de cocina de silicona',
  'Canastas de basura',
  'Cortinas para habitación',
  'Tapete de bienvenida',
  'Sartén antiadherente',
  'Juego de cestas para ropa sucia y limpia',
  'Kit de limpieza inicial (detergentes, desinfectantes, esponjas)',
  'Juegos de toallas de baño',
  'Juegos de toallas de manos',
  'Escurridor de platos y cubiertos',
  'Tapete de baño',
  'Cajas organizadoras',
  'Picador de verduras',
  'Organizador de cosméticos',
  'Toallas faciales',
  'Varitas aromáticas para hogar y baños',
  'Individuales de comedor',
  'Centros de mesa',
  'Fruteros',
  'Colgador de pantalones',
  'Organizador de cubiertos',
  'Cajones organizadores plásticos para nevera',
  'Olla a presión',
  'Colador y rallador',
  'Salida de baño hombre',
  'Salida de baño mujer',
];

const PRE_RESERVED_GIFTS: string[] = ['Vasos', 'Juego de ollas', 'Alfombras de pie de cama'];

async function main() {
  console.log('🌱 Seeding Mella (non-destructive)…');

  // 1. Placeholder invitation. upsert with empty `update` means "create if missing,
  //    don't touch if present".
  const placeholder = await prisma.invitation.upsert({
    where: { token: 'preasgn' },
    update: {},
    create: {
      token: 'preasgn',
      guestName: 'Apartado previamente',
      cupos: 0,
      status: RsvpStatus.DECLINED,
      notes: 'Placeholder reservation holder for gifts reserved before the app existed.',
    },
  });

  // 2. Snapshot of what's already in the table. We use names as the natural key
  //    for "is this gift already seeded?".
  const existing = await prisma.gift.findMany({ select: { name: true, order: true } });
  const existingNames = new Set(existing.map((g) => g.name));
  const maxOrder = existing.reduce((m, g) => Math.max(m, g.order), -1);

  // 3. AVAILABLE gifts — only insert those that don't already exist by name.
  //    New rows get order values AFTER the highest existing order, so existing
  //    gift ordering is never disturbed.
  let addedAvailable = 0;
  let order = maxOrder + 1;
  for (const name of AVAILABLE_GIFTS) {
    if (existingNames.has(name)) continue;
    await prisma.gift.create({
      data: { name, order: order++, active: true, reservedById: null, reservedAt: null },
    });
    addedAvailable++;
  }

  // 4. PRE-RESERVED gifts — only insert missing ones, linked to the placeholder.
  let addedReserved = 0;
  for (const name of PRE_RESERVED_GIFTS) {
    if (existingNames.has(name)) continue;
    await prisma.gift.create({
      data: {
        name,
        order: order++,
        active: true,
        reservedById: placeholder.id,
        reservedAt: new Date(),
      },
    });
    addedReserved++;
  }

  // 5. Summary.
  const finalCount = await prisma.gift.count();
  const availableNow = await prisma.gift.count({ where: { reservedById: null, active: true } });
  console.log(
    `✓ Added ${addedAvailable} available gifts and ${addedReserved} pre-reserved gifts.`,
  );
  console.log(
    `✓ Gift table now has ${finalCount} rows (${availableNow} available, ${finalCount - availableNow} reserved).`,
  );
  console.log(`✓ No existing rows were modified or deleted.`);
  console.log(`✓ MenuItem intentionally left empty — fill it from /admin/menu.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
