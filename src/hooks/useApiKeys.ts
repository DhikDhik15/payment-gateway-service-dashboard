import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type { MerchantAPIKeyResponse, CreateMerchantAPIKeyResponse } from '@/types';

function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2;
}

export function useApiKeys() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-api-keys', user?.merchant_id],
    enabled: isAuthenticated && !!user?.merchant_id,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<MerchantAPIKeyResponse[]>('/api/v1/dashboard/api-keys', { signal });
      return response.data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (body: { name: string; expires_at?: string | null }) => {
      const response = await apiClient.post<CreateMerchantAPIKeyResponse>(
        '/api/v1/dashboard/api-keys',
        body,
        { retryOnUnauthorized: false },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-api-keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(
        `/api/v1/dashboard/api-keys/${encodeURIComponent(id)}/revoke`,
        undefined,
        { retryOnUnauthorized: false },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-api-keys'] });
    },
  });
}
