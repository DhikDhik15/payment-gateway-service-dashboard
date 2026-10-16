/**
 * Pure helpers for the dashboard overview endpoint.
 * Kept free of React / @/ imports so node:test can import them directly.
 */
import type { DashboardPaymentStats } from '../types/backend.ts';
import type { DashboardOverviewResponse } from '../types/backend.ts';
import type { PaymentStatus } from '../types/common.ts';

/**
 * Builds GET /api/v1/dashboard/overview[?from&to].
 * Intentionally omits merchant_id — backend derives merchant from JWT.
 */
export function buildOverviewPath(from?: string, to?: string): string {
  if (from && to) {
    const query = new URLSearchParams({ from, to });
    return `/api/v1/dashboard/overview?${query.toString()}`;
  }
  return '/api/v1/dashboard/overview';
}

/**
 * Terminal payment statuses that ended unsuccessfully, derived from the
 * domain PaymentStatus model (CREATED | PAID | PENDING | FAILED | EXPIRED |
 * CANCELLED). PAID is the only successful terminal status; CREATED/PENDING
 * are non-terminal. There is no REFUNDED payment status — refunds are a
 * separate domain and are never counted here.
 */
export const UNSUCCESSFUL_PAYMENT_STATUSES = [
  'FAILED',
  'EXPIRED',
  'CANCELLED',
] as const satisfies readonly PaymentStatus[];

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/** Per-status aggregate field backing each unsuccessful terminal status. */
const UNSUCCESSFUL_STATUS_FIELDS: Record<
  (typeof UNSUCCESSFUL_PAYMENT_STATUSES)[number],
  'failed' | 'expired' | 'cancelled'
> = {
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

/**
 * Resolves the "Unsuccessful Transactions" card value from an overview
 * response. Prefers the server-computed `unsuccessful_transactions` field
 * when the backend exposes it; otherwise sums the authoritative per-status
 * aggregates (failed + expired + cancelled) from the same merchant-isolated,
 * period-scoped response — never from the transactions visible on screen.
 * Returns 0 when no unsuccessful transactions exist.
 */
export function unsuccessfulTransactionsCount(
  payments: DashboardPaymentStats | null | undefined,
): number {
  if (!payments) return 0;
  if (
    typeof payments.unsuccessful_transactions === 'number' &&
    Number.isFinite(payments.unsuccessful_transactions) &&
    payments.unsuccessful_transactions >= 0
  ) {
    return Math.floor(payments.unsuccessful_transactions);
  }
  let total = 0;
  for (const status of UNSUCCESSFUL_PAYMENT_STATUSES) {
    total += toCount(payments[UNSUCCESSFUL_STATUS_FIELDS[status]]);
  }
  return total;
}

/** Narrowing helper for overview card wiring; returns 0 while loading. */
export function overviewUnsuccessfulCount(
  overview: DashboardOverviewResponse | null | undefined,
): number {
  return unsuccessfulTransactionsCount(overview?.payments);
}

// ─── Date-range filter ───────────────────────────────────────────────────────
// Contract (Phase 10J):
// - User perspective: inclusive start date + inclusive end date (calendar days).
// - Wire: existing `from` / `to` params. `to` is the EXCLUSIVE end — midnight
//   immediately after the selected end date. Never 23:59:59.
// - Calendar days are UTC days, matching the backend's UTC-midnight parsing of
//   date-only values. All math below uses UTC accessors so browser timezones
//   never shift the selected date.

export const OVERVIEW_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
] as const;

export type OverviewPresetKey = (typeof OVERVIEW_PRESETS)[number]['key'];

/** Canonical applied range: inclusive YYYY-MM-DD start/end + source preset. */
export interface OverviewAppliedRange {
  preset: OverviewPresetKey;
  /** Inclusive start date (YYYY-MM-DD, UTC day). */
  start: string;
  /** Inclusive end date (YYYY-MM-DD, UTC day). */
  end: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formats a Date as YYYY-MM-DD using its UTC calendar day. */
export function toDateOnlyUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Shifts a YYYY-MM-DD date by whole UTC days. Assumes valid input. */
export function addDaysDateOnly(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return toDateOnlyUTC(shifted);
}

/** Strict YYYY-MM-DD calendar validation (rejects 2026-02-30, bad shapes). */
export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const roundTrip = new Date(Date.UTC(y, m - 1, d));
  return (
    roundTrip.getUTCFullYear() === y &&
    roundTrip.getUTCMonth() === m - 1 &&
    roundTrip.getUTCDate() === d
  );
}

/**
 * Computes the inclusive {start, end} dates for a preset relative to `now`.
 * Pass an explicit `now` in tests for determinism. Handles month/year
 * boundaries and leap years via UTC calendar math.
 */
export function presetDateRange(
  preset: Exclude<OverviewPresetKey, 'custom'>,
  now: Date = new Date(),
): { start: string; end: string } {
  const today = toDateOnlyUTC(now);
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const y = addDaysDateOnly(today, -1);
      return { start: y, end: y };
    }
    case 'last7':
      return { start: addDaysDateOnly(today, -6), end: today };
    case 'last30':
      return { start: addDaysDateOnly(today, -29), end: today };
    case 'thisMonth': {
      const first = `${today.slice(0, 7)}-01`;
      return { start: first, end: today };
    }
    case 'lastMonth': {
      const [y, m] = today.split('-').map(Number);
      const first = new Date(Date.UTC(y, m - 2, 1));
      const last = new Date(Date.UTC(y, m - 1, 0));
      return { start: toDateOnlyUTC(first), end: toDateOnlyUTC(last) };
    }
  }
}

/** Documented default filter: Last 7 Days ending today (UTC). */
export function defaultOverviewRange(now: Date = new Date()): OverviewAppliedRange {
  const { start, end } = presetDateRange('last7', now);
  return { preset: 'last7', start, end };
}

/**
 * Derives the API query params from an applied range: `from` is the inclusive
 * start day, `to` is the exclusive end (midnight after the inclusive end day).
 */
export function toOverviewParams(range: Pick<OverviewAppliedRange, 'start' | 'end'>): {
  from: string;
  to: string;
} {
  return { from: range.start, to: addDaysDateOnly(range.end, 1) };
}

/** Validates a pending custom selection; returns a message or null when OK. */
export function validateOverviewRange(start: string, end: string): string | null {
  if (!isValidDateOnly(start)) return 'Start date must be a valid date (YYYY-MM-DD).';
  if (!isValidDateOnly(end)) return 'End date must be a valid date (YYYY-MM-DD).';
  if (start > end) return 'Start date must not be after the end date.';
  return null;
}

/** True when two applied ranges select the same window and preset. */
export function isSameOverviewRange(a: OverviewAppliedRange, b: OverviewAppliedRange): boolean {
  return a.preset === b.preset && a.start === b.start && a.end === b.end;
}
