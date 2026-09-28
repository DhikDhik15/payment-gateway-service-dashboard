export type DashboardRole = 'OWNER' | 'ADMIN' | 'VIEWER';
type DashboardUserStatus = 'ACTIVE' | 'DISABLED';

export interface AuthUser {
  id: string;
  merchant_id: string;
  email: string;
  role: DashboardRole;
  status: DashboardUserStatus;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  user: AuthUser;
  /** Memory-only. Never persist this value in browser storage. */
  token: string;
  expires_at: string;
}

export type SessionEndReason = 'expired' | 'merchant_inactive' | 'user_disabled';

export type AuthSessionState = Omit<AuthSession, 'token'>;

export interface AuthState {
  user: AuthUser | null;
  session: AuthSessionState | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True when a previously authenticated session ended unexpectedly. */
  sessionExpired: boolean;
  sessionEndReason: SessionEndReason | null;
}

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'loading';
