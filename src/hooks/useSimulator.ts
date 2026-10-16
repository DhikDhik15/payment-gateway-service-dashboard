import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { getSimulatorPaymentRefetchInterval } from '@/lib/simulator/polling';
import { getSimulatorApiKey } from '@/lib/simulator/credential';
import { simulatorTransitionInvalidations } from './invalidation';
import type { PaymentResponse, CreatePaymentRequest, CreatePaymentResponse } from '@/types';

function simulatorOptions() {
  const apiKey = getSimulatorApiKey();
  if (!apiKey) throw new ApiClientError(0, 'SIMULATOR_AUTH_REQUIRED', 'Enter a development simulator API key first.');
  return { apiKey, skipAuth: true, skipRefresh: true, credentials: 'omit' as const, retryOnUnauthorized: false };
}

export function useSimulatorCreatePayment() {
  return useMutation({ mutationFn: async ({ body, idempotencyKey }: { body: CreatePaymentRequest; idempotencyKey: string }) => { const response = await apiClient.post<CreatePaymentResponse>('/api/v1/simulator/payments', body, { ...simulatorOptions(), headers: { 'Idempotency-Key': idempotencyKey } }); return response.data; } });
}

export function useSimulatorPaymentDetail(paymentId?: string) {
  return useQuery<PaymentResponse>({ queryKey: ['simulator-payment-detail', paymentId], enabled: !!paymentId && !!getSimulatorApiKey(), refetchInterval: (query) => getSimulatorPaymentRefetchInterval(query.state.data?.status), queryFn: async ({ signal }) => { const response = await apiClient.get<PaymentResponse>(`/api/v1/simulator/payments/${encodeURIComponent(paymentId ?? '')}`, { ...simulatorOptions(), signal }); return response.data; } });
}

export function useSimulatorSuccess(paymentId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: async () => { const response = await apiClient.post<{ status: string }>(`/api/v1/simulator/payments/${encodeURIComponent(paymentId)}/success`, undefined, simulatorOptions()); return response.data; }, onSuccess: () => { for (const queryKey of simulatorTransitionInvalidations(paymentId)) { void queryClient.invalidateQueries({ queryKey }); } } });
}

export function useSimulatorFailure(paymentId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: async () => { const response = await apiClient.post<{ status: string }>(`/api/v1/simulator/payments/${encodeURIComponent(paymentId)}/fail`, undefined, simulatorOptions()); return response.data; }, onSuccess: () => { for (const queryKey of simulatorTransitionInvalidations(paymentId)) { void queryClient.invalidateQueries({ queryKey }); } } });
}
