'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';
import type { User } from '@/types';
import { TOKEN_COOKIE_KEY } from '@/lib/constants';

// ─── Shape ────────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** true once zustand has rehydrated from localStorage */
  isHydrated: boolean;
}

interface AuthActions {
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setHydrated: (v: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      // ── Initial state ───────────────────────────────────────────────────────
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrated: false,

      // ── Actions ─────────────────────────────────────────────────────────────
      /**
       * Called after successful login.
       * Saves the JWT to a js-cookie (readable by the Edge middleware)
       * and updates the Zustand in-memory state.
       */
      setAuth: (user, token) => {
        Cookies.set(TOKEN_COOKIE_KEY, token, {
          expires: 7, // days
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
        });
        set({ user, accessToken: token, isAuthenticated: true });
      },

      /**
       * Called on logout or when a 401 is received.
       * Removes the cookie so the middleware also sees the session as ended.
       */
      clearAuth: () => {
        Cookies.remove(TOKEN_COOKIE_KEY);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      setHydrated: (v) => set({ isHydrated: v }),
    }),
    {
      name: 'falcon-auth',
      // Gracefully fall back when running on the server (e.g. RSC hydration)
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : ({} as Storage),
      ),
      // Only persist non-sensitive derived fields; token is the source of truth
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
