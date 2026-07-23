import Link from 'next/link';
import AdminTabs from './_components/AdminTabs';
import LogoutButton from './_components/LogoutButton';
import LiveActivity from '@/components/admin/LiveActivity';
import { CornerFlourish } from '@/components/ui/Ornament';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky-safe-top relative border-b border-ink/10 bg-ivory-50/85 backdrop-blur-md z-30">
        {/* Corner flourishes — desktop only; mobile would clip them on narrow screens. */}
        <CornerFlourish className="absolute -top-1 -left-1 w-10 h-10 text-gold/50 hidden md:block pointer-events-none" />
        <CornerFlourish className="absolute -top-1 -right-1 w-10 h-10 text-gold/50 hidden md:block -scale-x-100 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 sm:pt-5 pb-2 flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
          <Link href="/admin" className="group flex items-baseline gap-2 sm:gap-3 min-w-0">
            <span className="display-italic text-2xl text-ink group-hover:text-terracotta transition-colors truncate">
              mella
            </span>
            <span className="smallcaps text-ink-muted hidden sm:inline">administración</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LiveActivity />
            <LogoutButton />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 -mx-2 sm:mx-0">
          <AdminTabs />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 md:py-14">
        {children}
      </main>
    </div>
  );
}
