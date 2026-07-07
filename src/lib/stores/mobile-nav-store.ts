"use client";

import { create } from "zustand";

interface MobileNavState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Shared open/close state for the mobile nav drawer (Header) so the bottom tab
 *  bar's "Menu" tab can open it. Not persisted — resets each load. */
export const useMobileNav = create<MobileNavState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
