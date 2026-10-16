/**
 * Pure helpers for dashboard payment list/detail React Query keys and paths.
 * Kept free of React / @/ imports so node:test can import them directly.
 */
import { addDaysDateOnly } from './overviewQuery';

export interface ListPaymentsParams {
  page?: number;
  limit?: number;
  status?: string;
  merchant_order_id?: string;
  payment_method?: string;
  search?: string;
  created_from?: string;
  created_to?: string;
}

/** Cache key only — merchantId must never be added to the HTTP query string. */
export function dashboardPaymentsQueryKey(
  merchantId: string | undefined,
  params: ListPaymentsParams,
) {
  return ['dashboard-payments', merchantId, params] as const;
}

/** Cache key only — merchantId must never be added to the HTTP path/query. */
export function dashboardPaymentDetailQueryKey(
  merchantId: string | undefined,
  paymentId: string | undefined,
) {
  return ['dashboard-payment-detail', merchantId, paymentId] as const;
}

/**
 * Builds GET /api/v1/dashboard/payments?... from list params.
 * Intentionally omits merchant_id — backend derives merchant from JWT.
 */
export function buildPaymentsListPath(params: ListPaymentsParams): string {
  const allowed = new Set<keyof ListPaymentsParams>([
    'page', 'limit', 'status', 'merchant_order_id', 'payment_method', 'search', 'created_from', 'created_to',
  ]);
  for (const key of Object.keys(params)) {
    if (!allowed.has(key as keyof ListPaymentsParams)) {
      throw new Error(`Unsupported payment list filter: ${key}`);
    }
  }
  const q = new URLSearchParams();
  if (params.page !== undefined) q.set('page', String(params.page));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.merchant_order_id) q.set('merchant_order_id', params.merchant_order_id);
  if (params.payment_method) q.set('payment_method', params.payment_method);
  if (params.search) q.set('search', params.search);
  if (params.created_from) q.set('created_from', params.created_from);
  if (params.created_to) q.set('created_to', params.created_to);
  const queryStr = q.toString();
  return `/api/v1/dashboard/payments${queryStr ? `?${queryStr}` : ''}`;
}

/**
 * Derives the payment-list date params from an applied calendar range.
 * The list endpoint accepts strict RFC3339 only (unlike the overview's
 * from/to, date-only is rejected), so days are sent as UTC-midnight
 * timestamps: inclusive start day, exclusive end (midnight after the
 * inclusive end day — never 23:59:59). A null range sends no date params
 * (established unfiltered list behavior).
 */
export function toPaymentsDateRangeParams(
  range: { start: string; end: string } | null | undefined,
): { created_from?: string; created_to?: string } {
  if (!range) return {};
  return {
    created_from: `${range.start}T00:00:00Z`,
    created_to: `${addDaysDateOnly(range.end, 1)}T00:00:00Z`,
  };
}
