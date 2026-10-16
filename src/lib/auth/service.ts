import { ApiClientError, apiClient, setApiClientRefreshHandler, setApiClientTokenGetter } from '@/lib/api/client';
import type { AuthCredentials, AuthSession, AuthUser } from '@/types/auth';

// Access tokens are intentionally module-memory only. The refresh token is an
// HttpOnly cookie and is never read or written by JavaScript.
let accessTokenInMemory: string | null = null;
let accessTokenExpiresAt: number | null = null;
let currentSession: AuthSession | null = null;
let refreshInFlight: Promise<AuthSession | null> | null = null;
// Monotonic transition epoch prevents a late refresh response from restoring
// a session after logout, account switching, or a terminal 401.
let authEpoch = 0;
let authTransition = false;
type SessionListener = (session: AuthSession | null) => void;
let sessionListener: SessionListener | null = null;

export const tokenStorage = {
  get(): string | null {
    return accessTokenInMemory;
  },
  set(token: string, expiresAt?: number): void {
    accessTokenInMemory = token;
    if (expiresAt !== undefined) accessTokenExpiresAt = expiresAt;
  },
  clear(): void {
    accessTokenInMemory = null;
    accessTokenExpiresAt = null;
  },
};

export interface IAuthService {
  login(credentials: AuthCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession | null>;
  getCurrentSession(): AuthSession | null;
  subscribe(listener: SessionListener): () => void;
  clearLocalSession(): void;
}

/**
 * Classify a getSession() rejection. getSession converts every 401 path
 * (expired token, invalid cookie) into a resolved null, so a rejection is a
 * transport or server failure by construction — never proof that the session
 * is invalid. The explicit 401 check is defense-in-depth against future
 * throw paths. Callers must offer a retry, not a login bounce.
 */
export function isRestoreFailure(error: unknown): boolean {
  return !(error instanceof ApiClientError && error.status === 401);
}

type AuthApiResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
};

function notify(session: AuthSession | null): void {
  currentSession = session;
  sessionListener?.(session);
}

function beginAuthTransition(): number {
  authEpoch += 1;
  authTransition = true;
  return authEpoch;
}

function finishAuthTransition(epoch: number): void {
  if (epoch === authEpoch) authTransition = false;
}

async function waitForRefresh(): Promise<void> {
  const pending = refreshInFlight;
  if (!pending) return;
  try {
    await pending;
  } catch {
    // The transition owns the final state; a failed refresh must not prevent
    // logout or an explicit account switch from completing.
  }
}

function normalizeSession(payload: AuthApiResponse): AuthSession {
  const expiresAt = Date.now() + payload.expires_in * 1000;
  return {
    user: payload.user,
    token: payload.access_token,
    expires_at: new Date(expiresAt).toISOString(),
  };
}

function remember(session: AuthSession, payloadExpiresIn?: number): AuthSession {
  const expiresAt = payloadExpiresIn === undefined
    ? Date.parse(session.expires_at)
    : Date.now() + payloadExpiresIn * 1000;
  tokenStorage.set(session.token, expiresAt);
  notify(session);
  return session;
}

function sessionFromCurrentToken(user: AuthUser, token: string): AuthSession | null {
  if (!accessTokenExpiresAt || accessTokenExpiresAt <= Date.now()) return null;
  return {
    user,
    token,
    expires_at: new Date(accessTokenExpiresAt).toISOString(),
  };
}

async function performRefresh(epoch: number): Promise<AuthSession | null> {
  try {
    const response = await apiClient.post<AuthApiResponse>('/api/v1/auth/refresh', undefined, {
      skipAuth: true,
      skipRefresh: true,
      credentials: 'include',
      retryOnUnauthorized: false,
    });
    // A response from an older epoch may still set an HttpOnly cookie in the
    // browser, but it must never repopulate JS memory or authenticated UI.
    if (epoch !== authEpoch || authTransition) return null;
    const session = normalizeSession(response.data);
    return remember(session, response.data.expires_in);
  } catch (error) {
    // A late 401 from an old refresh must not clear a newer account/session.
    if (epoch !== authEpoch || authTransition) return null;
    // A 401 means the cookie/session is no longer valid. Network and 5xx
    // failures are transient and must not be converted into a false logout.
    if (error instanceof ApiClientError && error.status === 401) {
      tokenStorage.clear();
      notify(null);
      return null;
    }
    throw error;
  }
}

export const authService: IAuthService = {
  async login(credentials: AuthCredentials): Promise<AuthSession> {
    const epoch = beginAuthTransition();
    try {
      // Clear any previous browser session before a deliberate account switch.
      // Wait for an already-started refresh so its cookie response cannot race
      // the logout or the new login.
      await waitForRefresh();
      try {
        await apiClient.post('/api/v1/auth/logout', undefined, {
          // Keep the memory-only access token attached so the backend can
          // invalidate the stable session ID even if refresh rotates first.
          skipRefresh: true,
          credentials: 'include',
          retryOnUnauthorized: false,
        });
      } catch {
        // A failed best-effort logout must not prevent a new login attempt.
      }
      if (epoch !== authEpoch) throw new Error('Authentication transition superseded');
      tokenStorage.clear();
      notify(null);
      const response = await apiClient.post<AuthApiResponse>('/api/v1/auth/login', credentials, {
        skipAuth: true,
        skipRefresh: true,
        credentials: 'include',
        retryOnUnauthorized: false,
      });
      if (epoch !== authEpoch) throw new Error('Authentication transition superseded');
      const session = remember(normalizeSession(response.data), response.data.expires_in);
      finishAuthTransition(epoch);
      return session;
    } catch (error) {
      finishAuthTransition(epoch);
      throw error;
    }
  },

  async logout(): Promise<void> {
    const epoch = beginAuthTransition();
    // Capture the bearer for the server request, then clear local state
    // immediately. The explicit token keeps logout memory-only while ensuring
    // the backend can use the stable sid even after JS memory is cleared.
    const accessToken = tokenStorage.get();
    tokenStorage.clear();
    notify(null);
    let lastError: unknown;
    try {
      await waitForRefresh();
      if (epoch !== authEpoch) return;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await apiClient.post('/api/v1/auth/logout', undefined, {
            token: accessToken ?? undefined,
            skipRefresh: true,
            credentials: 'include',
            retryOnUnauthorized: false,
          });
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (epoch !== authEpoch) return;
        }
      }
      if (epoch === authEpoch) {
        tokenStorage.clear();
        notify(null);
      }
      finishAuthTransition(epoch);
      if (lastError) throw lastError;
    } catch (error) {
      finishAuthTransition(epoch);
      throw error;
    }
  },

  async getSession(): Promise<AuthSession | null> {
    if (authTransition) return null;
    const token = tokenStorage.get();
    if (!token) return this.refreshSession();

    try {
      const response = await apiClient.get<AuthUser>('/api/v1/auth/me', {
        token,
        credentials: 'include',
        retryOnUnauthorized: false,
      });
      const session = sessionFromCurrentToken(response.data, token);
      if (!session) return this.refreshSession();
      notify(session);
      return session;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        return this.refreshSession();
      }
      throw error;
    }
  },

  async refreshSession(): Promise<AuthSession | null> {
    if (authTransition) return null;
    if (refreshInFlight) return refreshInFlight;
    const epoch = authEpoch;
    const tracked: Promise<AuthSession | null> = performRefresh(epoch).finally(() => {
      if (refreshInFlight === tracked) refreshInFlight = null;
    });
    refreshInFlight = tracked;
    return tracked;
  },

  getCurrentSession(): AuthSession | null {
    return currentSession;
  },

  subscribe(listener: SessionListener): () => void {
    sessionListener = listener;
    return () => {
      if (sessionListener === listener) sessionListener = null;
    };
  },

  clearLocalSession(): void {
    // Invalidate any refresh response that is still in flight before clearing
    // the memory token. This is the terminal-401/account-switch barrier.
    authEpoch += 1;
    tokenStorage.clear();
    notify(null);
  },
};

// The API client owns refresh coordination for ordinary requests. The service
// itself still provides a single-flight promise, so concurrent 401 responses
// cannot rotate the same HttpOnly refresh cookie more than once.
setApiClientRefreshHandler(async () => {
  const session = await authService.refreshSession();
  return session?.token ?? null;
});

setApiClientTokenGetter(() => tokenStorage.get());
