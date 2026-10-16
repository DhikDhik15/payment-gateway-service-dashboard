/**
 * Pure helpers for the dashboard analytics endpoint.
 * Kept free of React / @/ imports so node:test can import them directly.
 */

/** Query-key prefix; distinct from 'dashboard-overview' by design. */
export const DASHBOARD_ANALYTICS_KEY = 'dashboard-analytics' as const;

/**
 * Builds GET /api/v1/dashboard/analytics?from&to from normalized UTC dates.
 * `to` is the exclusive end (midnight after the inclusive end day).
 * Intentionally omits merchant_id — backend derives merchant from JWT.
 */
export function buildAnalyticsPath(from: string, to: string): string {
  const query = new URLSearchParams({ from, to });
  return `/api/v1/dashboard/analytics?${query.toString()}`;
}

/** Cache key only — merchantId must never be added to the HTTP query string. */
export function dashboardAnalyticsQueryKey(
  merchantId: string | undefined,
  from: string,
  to: string,
) {
  return [DASHBOARD_ANALYTICS_KEY, merchantId, from, to] as const;
}
