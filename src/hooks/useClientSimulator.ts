import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPayment, getPayment, cancelPayment, getPayments } from '@/lib/client-simulator/api';
import { getClientApiKey } from '@/lib/client-simulator/credential';
import type {
  PaymentResponse,
  CreatePaymentRequest,
} from '@/types';

function isClientReady(): boolean {
  return !!getClientApiKey();
}

// ─── Create Payment ────────────────────────────────────────────────────────────

export function useClientCreatePayment() {
  return useMutation({
    mutationFn: async ({
      body,
      idempotencyKey,
    }: {
      body: CreatePaymentRequest;
      idempotencyKey: string;
    }) => createPayment(body, idempotencyKey),
  });
}

// ─── Payment Detail (with polling) ────────────────────────────────────────────

function clientPaymentRefetchInterval(data: PaymentResponse | undefined): number | false {
  if (!data) return false;
  if (data.status === 'CREATED' || data.status === 'PENDING') return 3000;
  return false;
}

export function useClientPaymentDetail(paymentId?: string) {
  return useQuery<PaymentResponse>({
    queryKey: ['client-payment-detail', paymentId],
    enabled: !!paymentId && isClientReady(),
    refetchInterval: (query) => clientPaymentRefetchInterval(query.state.data),
    queryFn: async () => {
      if (!paymentId) throw new Error('Payment ID required');
      return getPayment(paymentId);
    },
  });
}

// ─── Cancel Payment ───────────────────────────────────────────────────────────

export function useClientCancelPayment(paymentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => cancelPayment(paymentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-payment-detail', paymentId] });
      void queryClient.invalidateQueries({ queryKey: ['client-payments'] });
    },
  });
}

// ─── Payment List ─────────────────────────────────────────────────────────────

export function useClientPayments(page = 1, limit = 20) {
  return useQuery<PaymentResponse[]>({
    queryKey: ['client-payments', page, limit],
    enabled: isClientReady(),
    queryFn: async () => getPayments(page, limit),
  });
}
