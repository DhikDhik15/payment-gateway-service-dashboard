/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setApiClientSessionExpiredHandler } from '@/lib/api/client';
import type { AuthState, AuthCredentials, AuthSession, AuthSessionState, SessionEndReason } from '@/types/auth';
import { authService } from './service';

interface AuthContextValue extends AuthState {
  login: (credentials: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  sessionExpired: false,
  sessionEndReason: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionState(session: AuthSession): AuthSessionState {
  return { user: session.user, expires_at: session.expires_at };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(initialState);
  const clearMerchantData = useCallback(() => {
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  // The API client can discover an expired session while a query is in flight.
  // Clear all merchant-scoped data immediately so a previous merchant can
  // never flash on the next login.
  useEffect(() => {
    setApiClientSessionExpiredHandler((reason: SessionEndReason = 'expired') => {
      authService.clearLocalSession();
      clearMerchantData();
      setState({
        ...initialState,
        isLoading: false,
        sessionExpired: true,
        sessionEndReason: reason,
      });
    });
    return () => setApiClientSessionExpiredHandler(null);
  }, [clearMerchantData]);

  // Keep React state in sync with refreshes initiated by the API client and
  // with explicit logout. Access-token values stay in authService memory.
  useEffect(() => authService.subscribe((session) => {
    if (session) {
      setState({
        user: session.user,
        session: sessionState(session),
        isAuthenticated: true,
        isLoading: false,
        sessionExpired: false,
        sessionEndReason: null,
      });
      return;
    }
    setState((current) => ({
      ...initialState,
      isLoading: false,
      sessionExpired: current.sessionExpired,
    }));
  }), []);

  useEffect(() => {
    let cancelled = false;
    void authService.getSession()
      .then((session) => {
        if (cancelled) return;
        setState({
          user: session?.user ?? null,
          session: session ? sessionState(session) : null,
          isAuthenticated: session !== null,
          isLoading: false,
          sessionExpired: false,
          sessionEndReason: null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // A network failure during restore must not leave a loading screen.
        setState({ ...initialState, isLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh shortly before expiry. A failed refresh is handled by the API
  // client's explicit session-expiry callback; this timer never retries a
  // mutation or stores a refresh token.
  useEffect(() => {
    if (!state.isAuthenticated || !state.session) return;
    const expiry = Date.parse(state.session.expires_at);
    if (!Number.isFinite(expiry)) return;
    const delay = Math.max(1_000, expiry - Date.now() - 60_000);
    const timer = window.setTimeout(() => {
      void authService.refreshSession().catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.isAuthenticated, state.session]);

  const login = useCallback(async (credentials: AuthCredentials) => {
    clearMerchantData();
    const session = await authService.login(credentials);
    setState({
      user: session.user,
      session: sessionState(session),
      isAuthenticated: true,
      isLoading: false,
      sessionExpired: false,
      sessionEndReason: null,
    });
  }, [clearMerchantData]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearMerchantData();
      setState({ ...initialState, isLoading: false });
    }
  }, [clearMerchantData]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
