import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/client';
import type { ReactNode } from 'react';

// ─── Query Client ─────────────────────────────────────────────────────────────
//
// Configuration for TanStack Query.
// All dashboard data fetching hooks (usePayments, useOverview, etc.) 
// utilize this client for caching and state management.
// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry once before showing an error
      retry: (failureCount, error) =>
        (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 1,
      // Data is considered fresh for 30 seconds
      staleTime: 30_000,
      // Refetch on window focus (good for dashboard real-time feel)
      refetchOnWindowFocus: true,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
