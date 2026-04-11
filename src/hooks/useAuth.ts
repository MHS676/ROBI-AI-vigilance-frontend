'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import Cookies from 'js-cookie';
import { TOKEN_COOKIE_KEY, ROLE_HOME } from '@/lib/constants';
import type { LoginDto } from '@/types';

/**
 * Primary auth hook — wraps the Zustand store with:
 *  - SSR-safe hydration guard (avoids mismatch on first render)
 *  - login() action that calls the API and redirects to the correct dashboard
 *  - logout() action that clears state + cookie and redirects to /login
 */
export function useAuth() {
  const store           = useAuthStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth       = useAuthStore((s) => s.clearAuth);
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── Sync check: clear store if the cookie disappeared (e.g. browser cleared it)
  useEffect(() => {
    const token = Cookies.get(TOKEN_COOKIE_KEY);
    if (!token && isAuthenticated) {
      clearAuth();
    }
  }, [isAuthenticated, clearAuth]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = async (dto: LoginDto) => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const { data } = await authApi.login(dto);
      store.setAuth(data.user, data.access_token);
      const destination = ROLE_HOME[data.user.role] ?? '/admin/dashboard';
      router.replace(destination);
    } catch (err: unknown) {
      const raw = (
        err as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : (raw ?? 'Invalid email or password.');
      setLoginError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = () => {
    store.clearAuth();
    router.replace('/login');
  };

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isHydrated: store.isHydrated,
    accessToken: store.accessToken,
    login,
    logout,
    loginError,
    isLoggingIn,
  };
}
