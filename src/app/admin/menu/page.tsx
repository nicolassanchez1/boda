import { prisma } from '@/lib/prisma';
import MenuManager from './_components/MenuManager';

export const revalidate = 60;

export default async function MenuPage() {
  const [mainDishes, drinks] = await Promise.all([
    prisma.menuItem.findMany({
      where: { type: 'MAIN_DISH' },
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
          Platos principales y bebidas que los invitados pueden elegir.
        </p>
      </header>

      <section>
        <MenuManager title="Platos principales" type="MAIN_DISH" items={mainDishes} />
      </section>

      <section>
        <MenuManager title="Bebidas" type="DRINK" items={drinks} />
      </section>
    </div>
  );
}
