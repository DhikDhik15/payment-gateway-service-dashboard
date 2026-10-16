import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { RestoreErrorScreen } from './RestoreErrorScreen';
import { LoadingPage } from '@/components/feedback';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wraps routes that require authentication.
 * Redirects to /login if unauthenticated, preserving the intended destination.
 * A failed session restore (network/server failure, not an auth failure)
 * renders a retry screen instead: the session may still be valid.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, restoreFailed, retryRestore } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (restoreFailed && !isAuthenticated) {
    return <RestoreErrorScreen onRetry={retryRestore} />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <>{children}</>;
}
