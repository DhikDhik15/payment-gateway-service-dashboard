import { ApiClientError, publicApiClient } from '@/lib/api';
import { buildMockPaymentPath, isMockPaymentResponse } from './contract';
import type { MockPaymentResponse } from '@/types';

function invalidPublicPaymentResponse(): ApiClientError {
  return new ApiClientError(0, 'INVALID_RESPONSE', 'The payment response was invalid. Please try again.');
}

export async function fetchPublicMockPayment(
  identifier: string,
  signal?: AbortSignal,
): Promise<MockPaymentResponse> {
  const response = await publicApiClient.get<MockPaymentResponse>(buildMockPaymentPath(identifier), { signal });
  if (!isMockPaymentResponse(response.data)) throw invalidPublicPaymentResponse();
  return response.data;
}

export async function simulatePublicMockPayment(
  identifier: string,
  action: 'success' | 'fail',
): Promise<MockPaymentResponse> {
  const response = await publicApiClient.post<MockPaymentResponse>(
    `${buildMockPaymentPath(identifier)}/${action}`,
    undefined,
  );
  if (!isMockPaymentResponse(response.data)) throw invalidPublicPaymentResponse();
  return response.data;
}
