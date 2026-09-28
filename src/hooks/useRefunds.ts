import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type { RefundResponse } from '@/types';

interface ListRefundsParams {
  page?: number;
  limit?: number;
  status?: string;
  payment_id?: string;
  created_from?: string;
  created_to?: string;
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2;
}

export function useRefunds(params: ListRefundsParams) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-refunds', user?.merchant_id, params],
    enabled: isAuthenticated && !!user?.merchant_id,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.set(key, String(value));
      });
      const queryString = query.toString();
      const path = `/api/v1/dashboard/refunds${queryString ? `?${queryString}` : ''}`;
      return apiClient.get<RefundResponse[]>(path, { signal });
    },
  });
}

export function useRefundDetail(refundId?: string) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-refund-detail', user?.merchant_id, refundId],
    enabled: isAuthenticated && !!refundId,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<RefundResponse>(
        `/api/v1/dashboard/refunds/${encodeURIComponent(refundId ?? '')}`,
        { signal },
      );
      return response.data;
    },
  });
}
