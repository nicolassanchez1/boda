'use client';

// Admin session state — client-side source of truth for "am I logged in?".
// Defense-in-depth alongside the server-side middleware: if the cookie ever
// fails to gate a request (edge runtime bug, cache, etc.), this guard still
// hides admin content from the browser.
//
// Persistence: only isAuthenticated + loggedInAt survive across reloads.
// All other state (locks, flags) is session-local.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type AdminSession = {
  isAuthenticated: boolean;
  loggedInAt: number | null;
  // Whether the admin panel is currently "locked" client-side. Distinct from
  // isAuthenticated so we can lock without losing the session (e.g., a
  // future "screen lock" feature).
  isLocked: boolean;

  markAuthenticated: () => void;
  clearSession: () => void;
  lock: () => void;
  unlock: () => void;
};

export const useAdminSession = create<AdminSession>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      loggedInAt: null,
      isLocked: false,

      markAuthenticated: () =>
        set({
          isAuthenticated: true,
          loggedInAt: Date.now(),
          isLocked: false,
        }),

      clearSession: () =>
        set({
          isAuthenticated: false,
          loggedInAt: null,
          isLocked: false,
        }),

      lock: () => set({ isLocked: true }),

      unlock: () =>
        set({
          isAuthenticated: false,
          loggedInAt: null,
          isLocked: false,
        }),
    }),
    {
      name: 'mella.admin.session',
      storage: createJSONStorage(() => localStorage),
      // Only persist the auth flag + timestamp. Don't persist locks or volatile
      // state — they should reset on each browser session.
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        loggedInAt: state.loggedInAt,
      }),
      // On rehydrate, bump version if we ever change the schema.
      version: 1,
    },
  ),
);
