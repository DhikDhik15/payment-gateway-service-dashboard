import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type {
  PaymentResponse,
  DashboardPaymentDetailResponse,
  CreateRefundRequest,
  RefundResponse,
  CreatePaymentRequest,
  CreatePaymentResponse,
} from '@/types';
import {
  buildPaymentsListPath,
  dashboardPaymentDetailQueryKey,
  dashboardPaymentsQueryKey,
  type ListPaymentsParams,
} from './paymentsQuery';
import {
  dashboardPaymentCreatedInvalidations,
  dashboardRefundCreatedInvalidations,
} from './invalidation';

export type { ListPaymentsParams };
export {
  buildPaymentsListPath,
  dashboardPaymentDetailQueryKey,
  dashboardPaymentsQueryKey,
};

function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2;
}

export function paymentRefetchInterval(status: string | undefined): number | false {
  return status === 'CREATED' || status === 'PENDING' ? 5_000 : false;
}

export function usePayments(params: ListPaymentsParams) {
  const { user, isAuthenticated } = useAuth();
  const merchantId = user?.merchant_id;

  return useQuery({
    queryKey: dashboardPaymentsQueryKey(merchantId, params),
    enabled: isAuthenticated && !!merchantId,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const path = buildPaymentsListPath(params);
      return apiClient.get<PaymentResponse[]>(path, { signal });
    },
  });
}

export function usePaymentDetail(paymentId?: string) {
  const { user, isAuthenticated } = useAuth();
  const merchantId = user?.merchant_id;

  return useQuery({
    queryKey: dashboardPaymentDetailQueryKey(merchantId, paymentId),
    enabled: isAuthenticated && !!paymentId && !!merchantId,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<DashboardPaymentDetailResponse>(
        `/api/v1/dashboard/payments/${encodeURIComponent(paymentId ?? '')}`,
        { signal },
      );
      return response.data;
    },
    refetchInterval: (query) => paymentRefetchInterval(query.state.data?.status),
  });
}

export function useCreateRefund(paymentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, idempotencyKey }: { body: CreateRefundRequest; idempotencyKey: string }) => {
      const response = await apiClient.post<RefundResponse>(
        `/api/v1/dashboard/payments/${encodeURIComponent(paymentId)}/refunds`,
        body,
        {
          headers: { 'Idempotency-Key': idempotencyKey },
          // A 401 means the backend auth middleware rejected the request
          // before the handler ran, so one refresh-and-retry with the same
          // stable key is safe; the key itself is never regenerated here.
          retryOnUnauthorized: true,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      for (const queryKey of dashboardRefundCreatedInvalidations()) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, idempotencyKey }: { body: CreatePaymentRequest; idempotencyKey: string }) => {
      const response = await apiClient.post<CreatePaymentResponse>(
        '/api/v1/dashboard/payments',
        body,
        {
          headers: { 'Idempotency-Key': idempotencyKey },
          retryOnUnauthorized: true,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      for (const queryKey of dashboardPaymentCreatedInvalidations()) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
