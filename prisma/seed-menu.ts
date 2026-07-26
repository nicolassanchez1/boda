// Seeds the full catering menu (mains, sides, drinks) with photos from the
// caterer's PDF. Idempotent and NON-destructive — same safety contract as
// prisma/seed.ts:
//
//   - Never calls deleteMany, never updates an existing row.
//   - Only inserts an item if no MenuItem with that (name, type) already exists.
//   - New rows get order values AFTER the highest existing order for their type,
//     so any manual ordering you set in /admin/menu is never disturbed.
//
// Photos live in /public/menu. Sides (arroces / ensaladas) are buffet — shown
// in the menu but not chosen in the RSVP (the picker only offers mains + drinks).
//
// Usage:  npm run db:seed:menu
//
// After running, /admin/menu manages all of these (title + photo) and the guest
// menu showcase renders them. Re-running is safe (adds nothing that exists).

import { PrismaClient, MenuType } from '@prisma/client';

const prisma = new PrismaClient();

type SeedItem = {
  name: string;
  description: string;
  type: MenuType;
  imageUrl: string;
};

const ITEMS: SeedItem[] = [
  {
    name: 'Roast Beef en salsa de champiñones',
    description:
      'Medallones de lomo de res cocinados al punto, napados con una fina salsa de champiñones frescos.',
    type: MenuType.MAIN_DISH,
    imageUrl: '/menu/plato-roast-beef.jpg',
  },
  {
    name: 'Suprema de pollo en salsa de maracuyá',
    description:
      'Jugosa pechuga de pollo dorada a la plancha, bañada en una delicada salsa de maracuyá.',
    type: MenuType.MAIN_DISH,
    imageUrl: '/menu/plato-pollo-maracuya.jpg',
  },
  {
    name: 'Arroz de almendras',
    description:
      'Arroz de grano largo con almendras laminadas ligeramente tostadas y un toque de perejil.',
    type: MenuType.SIDE,
    imageUrl: '/menu/arroz-almendras.jpg',
  },
  {
    name: 'Arroz primavera',
    description: 'Delicado arroz de grano largo con maíz dulce y cebollín fresco.',
    type: MenuType.SIDE,
    imageUrl: '/menu/arroz-primavera.jpg',
  },
  {
    name: 'Ensalada campestre gourmet',
    description:
      'Hojas verdes, tomates cherry, aceitunas y queso fresco, con vinagreta de hierbas.',
    type: MenuType.SIDE,
    imageUrl: '/menu/ensalada-campestre.jpg',
  },
  {
    name: 'Ensalada de manzana y nueces',
    description:
      'Hojas verdes, manzana, queso fresco, nueces y arándanos, con vinagreta de miel y mostaza.',
    type: MenuType.SIDE,
    imageUrl: '/menu/ensalada-manzana-nueces.jpg',
  },
  {
    name: 'Limonada de hierbabuena',
    description: 'Refrescante limonada de limón fresco y hojas de hierbabuena.',
    type: MenuType.DRINK,
    imageUrl: '/menu/limonada-hierbabuena.jpg',
  },
  {
    name: 'Jugo de mango',
    description: 'Pulpa de mango maduro, dulce, suave y con aroma tropical.',
    type: MenuType.DRINK,
    imageUrl: '/menu/jugo-mango.jpg',
  },
];

async function main() {
  console.log('🍽️  Seeding menu (non-destructive)…');

  const existing = await prisma.menuItem.findMany({
    select: { name: true, type: true, order: true },
  });
  const existingKey = new Set(existing.map((m) => `${m.type}::${m.name}`));

  // Next order value per type, so existing ordering is preserved.
  const nextOrder: Record<string, number> = {};
  for (const m of existing) {
    nextOrder[m.type] = Math.max(nextOrder[m.type] ?? -1, m.order);
  }

  let added = 0;
  for (const item of ITEMS) {
    if (existingKey.has(`${item.type}::${item.name}`)) continue;
    const order = (nextOrder[item.type] ?? -1) + 1;
    nextOrder[item.type] = order;
    await prisma.menuItem.create({
      data: {
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        type: item.type,
        active: true,
        order,
      },
    });
    added++;
  }

  const mains = await prisma.menuItem.count({ where: { type: MenuType.MAIN_DISH } });
  const sides = await prisma.menuItem.count({ where: { type: MenuType.SIDE } });
  const drinks = await prisma.menuItem.count({ where: { type: MenuType.DRINK } });
  console.log(`✓ Added ${added} new menu item(s). No existing rows modified.`);
  console.log(`✓ Menu now has ${mains} main(s), ${sides} side(s) and ${drinks} drink(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
