import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type { DashboardAnalyticsResponse } from '@/types';
import { buildAnalyticsPath, dashboardAnalyticsQueryKey } from './analyticsQuery';

export function useAnalytics(from: string, to: string) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: dashboardAnalyticsQueryKey(user?.merchant_id, from, to),
    enabled: isAuthenticated && !!user?.merchant_id,
    staleTime: 15_000,
    retry: (failureCount, error) =>
      (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<DashboardAnalyticsResponse>(
        buildAnalyticsPath(from, to),
        { signal },
      );
      return response.data;
    },
  });
}
