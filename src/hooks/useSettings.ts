import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type { DashboardMerchantSettingsResponse, DashboardUserResponse } from '@/types';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 2;
}

export function useSettings() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-settings', user?.merchant_id],
    enabled: isAuthenticated && !!user?.merchant_id,
    staleTime: 30_000,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<DashboardMerchantSettingsResponse>('/api/v1/dashboard/settings', { signal });
      return response.data;
    },
  });
}

export function useUsers() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-users', user?.merchant_id],
    enabled: isAuthenticated && !!user?.merchant_id,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<DashboardUserResponse[]>('/api/v1/dashboard/users', { signal });
      return response.data;
    },
  });
}
