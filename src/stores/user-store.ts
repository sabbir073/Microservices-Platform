import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, PackageTier } from "@/types";

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  updateBalance: (points: number, cash: number) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),
      
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      
      updateBalance: (points, cash) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                pointsBalance: state.user.pointsBalance + points,
                cashBalance: state.user.cashBalance + cash,
              }
            : null,
        })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: "user-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
