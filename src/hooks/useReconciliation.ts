import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type { ReconciliationResult } from '@/types';

interface ListReconciliationParams { page?: number; limit?: number; settlement_id?: string; result_type?: string; reason_code?: string; date_from?: string; date_to?: string; }
function shouldRetry(count: number, error: unknown): boolean { return (!(error instanceof ApiClientError) || error.status >= 500) && count < 2; }

export function useReconciliationMismatches(params: ListReconciliationParams) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({ queryKey: ['dashboard-reconciliation', user?.merchant_id, params], enabled: isAuthenticated && !!user?.merchant_id, retry: shouldRetry, queryFn: async ({ signal }) => { const allowed = new Set<keyof ListReconciliationParams>(['page', 'limit', 'settlement_id', 'result_type', 'reason_code', 'date_from', 'date_to']); for (const key of Object.keys(params)) if (!allowed.has(key as keyof ListReconciliationParams)) throw new Error(`Unsupported reconciliation filter: ${key}`); const query = new URLSearchParams(); if (params.page !== undefined) query.set('page', String(params.page)); if (params.limit !== undefined) query.set('limit', String(params.limit)); if (params.settlement_id) query.set('settlement_id', params.settlement_id); if (params.result_type) query.set('result_type', params.result_type); if (params.reason_code) query.set('reason_code', params.reason_code); if (params.date_from) query.set('date_from', params.date_from); if (params.date_to) query.set('date_to', params.date_to); const queryString = query.toString(); return apiClient.get<ReconciliationResult[]>(`/api/v1/dashboard/reconciliation/mismatches${queryString ? `?${queryString}` : ''}`, { signal }); } });
}

export function useReconciliationDetail(id?: string) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({ queryKey: ['dashboard-reconciliation-detail', user?.merchant_id, id], enabled: isAuthenticated && !!id, retry: shouldRetry, queryFn: async ({ signal }) => { const response = await apiClient.get<ReconciliationResult>(`/api/v1/dashboard/reconciliation/mismatches/${encodeURIComponent(id ?? '')}`, { signal }); return response.data; } });
}
