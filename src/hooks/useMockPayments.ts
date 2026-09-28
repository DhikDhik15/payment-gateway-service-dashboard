import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api';
import { fetchPublicMockPayment, mockPaymentRefetchInterval, simulatePublicMockPayment } from '@/lib/mock-payment';

export const mockPaymentQueryKey = (identifier?: string) => ['mock-payment', identifier] as const;

function shouldRetryPublicPayment(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiClientError) {
    return (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT' || error.status >= 500)
      && failureCount < 2;
  }
  return failureCount < 2;
}

export function usePublicMockPayment(identifier?: string) {
  return useQuery({
    queryKey: mockPaymentQueryKey(identifier),
    enabled: !!identifier,
    retry: shouldRetryPublicPayment,
    queryFn: ({ signal }) => fetchPublicMockPayment(identifier ?? '', signal),
    refetchInterval: (query) => mockPaymentRefetchInterval(query.state.data),
  });
}

function useMockPaymentTransition(identifier: string, action: 'success' | 'fail') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => simulatePublicMockPayment(identifier, action),
    onSettled: async () => {
      // The mutation response is intentionally not written into the query
      // cache. The provider endpoint is the source of truth; refetch its DTO
      // after both successful and rejected transitions (including expiry).
      await queryClient.invalidateQueries({ queryKey: mockPaymentQueryKey(identifier) });
    },
  });
}

export function useSimulateMockPaymentSuccess(identifier: string) {
  return useMockPaymentTransition(identifier, 'success');
}

export function useSimulateMockPaymentFailure(identifier: string) {
  return useMockPaymentTransition(identifier, 'fail');
}
