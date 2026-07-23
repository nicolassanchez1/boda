// Zustand store for admin UI state that should persist across page navigation.
// Currently: which filter chip is active in the Invitados tab.

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Filter = 'all' | 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'never-opened';

type AdminFiltersStore = {
  filter: Filter;
  setFilter: (f: Filter) => void;
};

export const useAdminFilters = create<AdminFiltersStore>()(
  persist(
    (set) => ({
      filter: 'all',
      setFilter: (filter) => set({ filter }),
    }),
    {
      name: 'mella.admin.filters',
      storage: createJSONStorage(() => localStorage),
      // Only persist the filter value; setFilter is stable.
      partialize: (state) => ({ filter: state.filter }),
    },
  ),
);
