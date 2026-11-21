import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, authApi, setUnauthorizedHandler } from '@/services/api';
import { clearToken, getToken, setToken } from '@/services/storage';
import type { CurrentUser, TokenResponse } from '@/types';

interface AuthContextValue {
  user: CurrentUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeVerification: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Sign in with a token the server already issued (e.g. straight after registering). */
  startSession: (token: string, user: CurrentUser) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: CurrentUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(async () => {
    await clearToken();
    setUserState(null);
  }, []);

  // Restore the session from the Keychain on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await getToken()) {
          const me = await authApi.me();
          if (!cancelled) setUserState(me);
        }
      } catch (err) {
        // Only drop the token if the server rejected it; keep it when offline.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) await clearToken();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const acceptToken = useCallback(async (res: TokenResponse) => {
    await setToken(res.access_token);
    setUserState(res.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => acceptToken(await authApi.login(email.trim(), password)),
    [acceptToken],
  );

  const completeVerification = useCallback(
    async (email: string, code: string) => acceptToken(await authApi.verifyEmail(email, code)),
    [acceptToken],
  );

  const refreshUser = useCallback(async () => {
    try {
      setUserState(await authApi.me());
    } catch {
      // keep the current user; screens surface their own errors
    }
  }, []);

  const startSession = useCallback(
    async (token: string, me: CurrentUser) => acceptToken({ access_token: token, token_type: 'bearer', user: me }),
    [acceptToken],
  );

  const value = useMemo(
    () => ({ user, initializing, login, completeVerification, logout, startSession, refreshUser, setUser: setUserState }),
    [user, initializing, login, completeVerification, logout, startSession, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
