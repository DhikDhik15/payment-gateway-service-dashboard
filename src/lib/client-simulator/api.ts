// Client Simulator API calls — External Client API (/api/v1/payments).
// These calls use X-API-Key auth, not dashboard JWT. The API key is held
// in memory only and never persisted.

import { apiClient } from '@/lib/api/client';
import { getClientApiKey } from './credential';
import type {
  PaymentResponse,
  CreatePaymentRequest,
  CreatePaymentResponse,
} from '@/types';

function clientOptions() {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error('Enter an API key first.');
  }
  return {
    apiKey,
    skipAuth: true,
    skipRefresh: true,
    credentials: 'omit' as const,
    retryOnUnauthorized: false,
  };
}

export async function createPayment(
  body: CreatePaymentRequest,
  idempotencyKey: string,
): Promise<CreatePaymentResponse> {
  const response = await apiClient.post<CreatePaymentResponse>(
    '/api/v1/payments',
    body,
    {
      ...clientOptions(),
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
  return response.data;
}

export async function getPayment(paymentId: string): Promise<PaymentResponse> {
  const response = await apiClient.get<PaymentResponse>(
    `/api/v1/payments/${encodeURIComponent(paymentId)}`,
    clientOptions(),
  );
  return response.data;
}

export async function cancelPayment(paymentId: string): Promise<PaymentResponse> {
  const response = await apiClient.post<PaymentResponse>(
    `/api/v1/payments/${encodeURIComponent(paymentId)}/cancel`,
    undefined,
    clientOptions(),
  );
  return response.data;
}

export async function getPayments(page = 1, limit = 20): Promise<PaymentResponse[]> {
  const response = await apiClient.get<PaymentResponse[]>(
    `/api/v1/payments?page=${page}&limit=${limit}`,
    clientOptions(),
  );
  return response.data;
}
