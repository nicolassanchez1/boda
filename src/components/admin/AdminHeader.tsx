'use client';

// Client wrapper for the admin header. Needed because we now have interactive
// state (the mobile drawer open/close) on top of the static admin chrome.

import { useState } from 'react';
import Link from 'next/link';
import AdminTabs from '@/app/admin/_components/AdminTabs';
import LogoutButton from '@/app/admin/_components/LogoutButton';
import LiveActivity from '@/components/admin/LiveActivity';
import MobileNav from '@/components/admin/MobileNav';
import { CornerFlourish } from '@/components/ui/Ornament';

export default function AdminHeader() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <>
      <header className="sticky-safe-top relative border-b border-ink/10 bg-ivory-50/85 backdrop-blur-md z-30">
        {/* Corner flourishes — desktop only; mobile would clip them on narrow screens. */}
        <CornerFlourish className="absolute -top-1 -left-1 w-10 h-10 text-gold/50 hidden md:block pointer-events-none" />
        <CornerFlourish className="absolute -top-1 -right-1 w-10 h-10 text-gold/50 hidden md:block -scale-x-100 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 sm:pt-5 pb-2 flex items-center justify-between gap-2 sm:gap-4">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={navOpen}
            aria-controls="admin-mobile-nav"
            className="cursor-pointer sm:hidden w-11 h-11 -ml-2 rounded-full hover:bg-ivory-100 flex items-center justify-center text-ink transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              className="w-5 h-5"
              aria-hidden
            >
              <path d="M4 7 L20 7" />
              <path d="M4 12 L20 12" />
              <path d="M4 17 L20 17" />
            </svg>
          </button>

          <Link
            href="/admin"
            className="group flex items-baseline gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial"
          >
            <span className="display-italic text-2xl text-ink group-hover:text-terracotta transition-colors truncate">
              mella
            </span>
            <span className="smallcaps text-ink-muted hidden sm:inline">
              administración
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LiveActivity />
            <LogoutButton />
          </div>
        </div>

        {/* Tabs — desktop only. Mobile uses the drawer. */}
        <div className="max-w-6xl mx-auto sm:px-6 -mx-4 sm:mx-0 px-4 hidden sm:block">
          <AdminTabs />
        </div>
      </header>

      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
    </>
  );
}
