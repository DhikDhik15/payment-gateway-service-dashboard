import { RouterProvider } from 'react-router-dom';
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary';
import { QueryProvider } from './providers/QueryProvider';
import { AuthProvider } from '@/lib/auth';
import { router } from '@/routes';

/**
 * Root application component.
 *
 * Provider order (outer → inner):
 *   QueryProvider  — TanStack Query cache
 *   AuthProvider   — authentication state
 *   RouterProvider — React Router
 *
 * Router is innermost so routes have access to auth context.
 */
export function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppErrorBoundary>
          <RouterProvider router={router} />
        </AppErrorBoundary>
      </AuthProvider>
    </QueryProvider>
  );
}
