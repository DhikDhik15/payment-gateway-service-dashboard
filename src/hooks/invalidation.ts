/**
 * Centralized TanStack Query invalidation targets for dashboard mutations.
 *
 * Kept free of React / @/ imports so node:test can import them directly.
 * Every entry is a key *prefix* (TanStack partial matching): invalidation
 * matches all merchant, page, filter, and date-range variants beneath it, so
 * a mutation can never leave a stale range behind. Per-merchant isolation is
 * preserved because the query keys themselves carry merchant_id and every
 * request is JWT-scoped; invalidation only marks caches stale, it never
 * moves data across merchants.
 *
 * Only the simulator detail key carries the payment id: its key shape is
 * ['simulator-payment-detail', paymentId], so it can be targeted exactly.
 * Dashboard keys embed merchant_id second (e.g. ['dashboard-payments',
 * merchantId, params]) while simulator mutations run on a memory-only dev
 * credential with no merchant context, so dashboard caches are refreshed via
 * their top-level prefixes — the established convention in this codebase.
 *
 * Rules followed here (backend is the authority; the frontend never invents
 * statuses or aggregates):
 * - Payment creation and simulator status transitions change paid counts and
 *   gross revenue, so they refresh list, detail, overview, and analytics.
 * - Refunds are a separate domain: the payment stays PAID and analytics
 *   reports gross paid revenue, so refunds refresh lists/detail/overview but
 *   intentionally leave analytics alone.
 * - Only successful mutations invalidate (wired via onSuccess, never
 *   onSettled/onError), so a failed mutation cannot rewrite authoritative
 *   server state.
 */

import { DASHBOARD_ANALYTICS_KEY } from './analyticsQuery.ts';

/** Prefix of the dashboard payment-list queries (all pages/filters/ranges). */
export const DASHBOARD_PAYMENTS_PREFIX = 'dashboard-payments' as const;

/** Prefix of the dashboard payment-detail queries (all merchants/ids). */
export const DASHBOARD_PAYMENT_DETAIL_PREFIX = 'dashboard-payment-detail' as const;

/** Prefix of the dashboard overview queries (all merchants/ranges). */
export const DASHBOARD_OVERVIEW_PREFIX = 'dashboard-overview' as const;

/** Prefix of the dashboard refund-list queries. */
export const DASHBOARD_REFUNDS_PREFIX = 'dashboard-refunds' as const;

/** Prefix of the simulator payment-detail queries (dev tenant). */
export const SIMULATOR_PAYMENT_DETAIL_PREFIX = 'simulator-payment-detail' as const;

export type InvalidationKey = readonly string[];

/**
 * Queries refreshed after a dashboard payment is created.
 * No detail key: the created payment has no cached detail yet.
 */
export function dashboardPaymentCreatedInvalidations(): readonly InvalidationKey[] {
  return [
    [DASHBOARD_PAYMENTS_PREFIX],
    [DASHBOARD_OVERVIEW_PREFIX],
    [DASHBOARD_ANALYTICS_KEY],
  ];
}

/**
 * Queries refreshed after a dashboard refund is created.
 * Analytics is deliberately excluded: refunds do not change the paid status
 * or gross paid revenue that analytics aggregates.
 */
export function dashboardRefundCreatedInvalidations(): readonly InvalidationKey[] {
  return [
    [DASHBOARD_PAYMENTS_PREFIX],
    [DASHBOARD_PAYMENT_DETAIL_PREFIX],
    [DASHBOARD_REFUNDS_PREFIX],
    [DASHBOARD_OVERVIEW_PREFIX],
  ];
}

/**
 * Queries refreshed after a simulator payment transitions (success/fail).
 * The same underlying payment is visible in the dashboard, so the dashboard
 * detail must refresh alongside the simulator detail; the transition changes
 * paid counts and revenue, so overview and analytics refresh too.
 */
export function simulatorTransitionInvalidations(paymentId: string): readonly InvalidationKey[] {
  return [
    [SIMULATOR_PAYMENT_DETAIL_PREFIX, paymentId],
    [DASHBOARD_PAYMENTS_PREFIX],
    [DASHBOARD_PAYMENT_DETAIL_PREFIX],
    [DASHBOARD_OVERVIEW_PREFIX],
    [DASHBOARD_ANALYTICS_KEY],
  ];
}
