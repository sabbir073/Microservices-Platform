"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AdminUIState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

export const useAdminUI = create<AdminUIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: "admin-ui",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
