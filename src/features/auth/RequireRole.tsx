import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { resolveRouteAccess } from '@/lib/auth/permissions';
import type { DashboardRole } from '@/types/auth';
import { LoadingPage } from '@/components/feedback';

interface RequireRoleProps {
  /** Roles permitted to render the wrapped route. */
  allowedRoles: readonly DashboardRole[];
  /** Safe in-app destination for authenticated users lacking the role. */
  fallback: string;
  children: ReactNode;
}

/**
 * Role-aware route guard. Composes inside authentication protection:
 * while auth is unresolved it renders a loading page (never restricted
 * content, never a redirect); unauthenticated users follow the login flow;
 * denied roles are sent to a safe fallback that is itself unrestricted, so
 * no redirect loop is possible.
 */
export function RequireRole({ allowedRoles, fallback, children }: RequireRoleProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const decision = resolveRouteAccess({
    isLoading,
    isAuthenticated,
    role: user?.role ?? null,
    allowedRoles,
    fallbackPath: fallback,
  });

  if (decision.kind === 'loading') return <LoadingPage />;
  if (decision.kind === 'login') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (decision.kind === 'forbidden') {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
