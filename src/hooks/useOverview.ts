import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type { DashboardOverviewResponse } from '@/types';
import { buildOverviewPath } from './overviewQuery';

export function useOverview(from?: string, to?: string) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-overview', user?.merchant_id, from, to],
    enabled: isAuthenticated && !!user?.merchant_id,
    staleTime: 15_000,
    retry: (failureCount, error) =>
      (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2,
    queryFn: async ({ signal }) => {
      const path = buildOverviewPath(from, to);
      const response = await apiClient.get<DashboardOverviewResponse>(path, { signal });
      return response.data;
    },
  });
}
