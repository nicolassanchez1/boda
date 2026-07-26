import { prisma } from '@/lib/prisma';
import MenuManager from './_components/MenuManager';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const [mainDishes, sides, drinks] = await Promise.all([
    prisma.menuItem.findMany({
      where: { type: 'MAIN_DISH' },
      orderBy: { order: 'asc' },
    }),
    prisma.menuItem.findMany({
      where: { type: 'SIDE' },
      orderBy: { order: 'asc' },
    }),
    prisma.menuItem.findMany({
      where: { type: 'DRINK' },
      orderBy: { order: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="display-xl text-3xl">Menú</h1>
        <p className="text-ink-muted text-sm mt-1">
          Los platos, acompañamientos y bebidas de tu boda. La foto y el título de
          cada uno se muestran en la invitación.
        </p>
      </header>

      <section>
        <MenuManager title="Platos principales" type="MAIN_DISH" items={mainDishes} />
      </section>

      <section>
        <MenuManager title="Acompañamientos" type="SIDE" items={sides} />
      </section>

      <section>
        <MenuManager title="Bebidas" type="DRINK" items={drinks} />
      </section>
    </div>
  );
}
