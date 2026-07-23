'use client';

// Client-side guard for /admin/*. Complements the server-side middleware:
//   - If the cookie gate fails for any reason (edge runtime, cache, deploy
//     race), this still hides the admin content until the user re-authenticates.
//   - Instant redirect on logout (no flash of cached admin content).
//
// The /admin/login page is excluded so the login form can render freely.

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminSession } from '@/lib/stores/admin-session';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAdminSession((s) => s.isAuthenticated);

  // Avoid SSR/CSR mismatch: Zustand persist hydrates from localStorage in
  // useEffect, so we render nothing (or a spinner) until mounted.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    if (pathname?.startsWith('/admin/login')) return;
    if (!isAuthenticated) {
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/admin/login${next}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  // Login page is always allowed (it's how you GET authenticated).
  const isLoginPage = pathname?.startsWith('/admin/login');

  // Pre-hydration: blank — same on server and client, no flash.
  if (!hydrated) return null;

  // After hydration on a non-login page: require auth.
  if (!isAuthenticated && !isLoginPage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 border-2 border-ink/15 border-t-terracotta rounded-full animate-spin" />
          <p className="text-sm text-ink-muted">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
