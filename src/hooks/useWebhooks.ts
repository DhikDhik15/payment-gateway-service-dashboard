import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type {
  MerchantWebhookConfigResponse,
  MerchantWebhookConfigWithSecretResponse,
  MerchantWebhookDeliveryResponse,
} from '@/types';

function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2;
}

export function useWebhookConfig() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-webhook-config', user?.merchant_id],
    enabled: isAuthenticated && !!user?.merchant_id,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<MerchantWebhookConfigResponse>(
        '/api/v1/dashboard/webhook-config',
        { signal },
      );
      return response.data;
    },
  });
}

export function useUpsertWebhookConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (body: { url: string; description?: string }) => {
      const response = await apiClient.put<MerchantWebhookConfigWithSecretResponse>(
        '/api/v1/dashboard/webhook-config',
        body,
        { retryOnUnauthorized: false },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-webhook-config'] });
    },
  });
}

export function useRotateWebhookSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const response = await apiClient.post<MerchantWebhookConfigWithSecretResponse>(
        '/api/v1/dashboard/webhook-config/rotate',
        undefined,
        { retryOnUnauthorized: false },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-webhook-config'] });
    },
  });
}

export function useDisableWebhookConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<MerchantWebhookConfigResponse>(
        '/api/v1/dashboard/webhook-config',
        { retryOnUnauthorized: false },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-webhook-config'] });
    },
  });
}

interface ListDeliveriesParams {
  page?: number;
  limit?: number;
}

export function useWebhookDeliveries(params: ListDeliveriesParams) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-webhooks', user?.merchant_id, params],
    enabled: isAuthenticated && !!user?.merchant_id,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      const queryString = query.toString();
      const response = await apiClient.get<MerchantWebhookDeliveryResponse[]>(
        `/api/v1/dashboard/webhooks${queryString ? `?${queryString}` : ''}`,
        { signal },
      );
      return response;
    },
  });
}

export function useWebhookDeliveryDetail(id?: string) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard-webhook-detail', user?.merchant_id, id],
    enabled: isAuthenticated && !!id,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<MerchantWebhookDeliveryResponse>(
        `/api/v1/dashboard/webhooks/${encodeURIComponent(id ?? '')}`,
        { signal },
      );
      return response.data;
    },
  });
}

export function useRetryWebhookDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<MerchantWebhookDeliveryResponse>(
        `/api/v1/dashboard/webhooks/${encodeURIComponent(id)}/retry`,
        undefined,
        { retryOnUnauthorized: false },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-webhooks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-webhook-detail'] });
    },
  });
}
