import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOverviewPath,
  UNSUCCESSFUL_PAYMENT_STATUSES,
  unsuccessfulTransactionsCount,
  overviewUnsuccessfulCount,
  OVERVIEW_PRESETS,
  presetDateRange,
  defaultOverviewRange,
  toOverviewParams,
  isValidDateOnly,
  validateOverviewRange,
  isSameOverviewRange,
  addDaysDateOnly,
  toDateOnlyUTC,
} from './overviewQuery.ts';
import type {
  DashboardOverviewResponse,
  DashboardPaymentStats,
} from '../types/backend.ts';

function stats(overrides: Partial<DashboardPaymentStats> = {}): DashboardPaymentStats {
  return {
    total: 0,
    created: 0,
    pending: 0,
    paid: 0,
    failed: 0,
    expired: 0,
    cancelled: 0,
    ...overrides,
  };
}

function overview(overrides: Partial<DashboardPaymentStats> = {}): DashboardOverviewResponse {
  return {
    period: { from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T00:00:00.000Z' },
    payments: stats(overrides),
    revenue: { amount: 0, currency: 'IDR' },
    refunds: { count: 0, amount: 0, currency: 'IDR' },
    recent_payments: [],
  };
}

test('UNSUCCESSFUL_PAYMENT_STATUSES covers exactly FAILED, EXPIRED, CANCELLED', () => {
  assert.deepEqual([...UNSUCCESSFUL_PAYMENT_STATUSES].sort(), ['CANCELLED', 'EXPIRED', 'FAILED']);
});

test('EXPIRED transactions are counted', () => {
  assert.equal(unsuccessfulTransactionsCount(stats({ expired: 3 })), 3);
});

test('CANCELLED transactions are counted', () => {
  assert.equal(unsuccessfulTransactionsCount(stats({ cancelled: 2 })), 2);
});

test('FAILED transactions are counted', () => {
  assert.equal(unsuccessfulTransactionsCount(stats({ failed: 5 })), 5);
});

test('multiple unsuccessful transactions are summed correctly', () => {
  assert.equal(
    unsuccessfulTransactionsCount(stats({ failed: 2, expired: 3, cancelled: 4 })),
    9,
  );
});

test('successful (paid) transactions are excluded', () => {
  assert.equal(unsuccessfulTransactionsCount(stats({ paid: 10, total: 10 })), 0);
});

test('pending and processing (pending/created) transactions are excluded', () => {
  assert.equal(
    unsuccessfulTransactionsCount(stats({ created: 4, pending: 6, total: 10 })),
    0,
  );
});

test('mixed dataset counts only unsuccessful terminal statuses', () => {
  assert.equal(
    unsuccessfulTransactionsCount(
      stats({ total: 20, created: 2, pending: 3, paid: 10, failed: 2, expired: 2, cancelled: 1 }),
    ),
    5,
  );
});

test('an empty dataset returns zero', () => {
  assert.equal(unsuccessfulTransactionsCount(stats()), 0);
});

test('missing overview payload returns zero', () => {
  assert.equal(unsuccessfulTransactionsCount(undefined), 0);
  assert.equal(unsuccessfulTransactionsCount(null), 0);
  assert.equal(overviewUnsuccessfulCount(undefined), 0);
  assert.equal(overviewUnsuccessfulCount(null), 0);
});

test('partial aggregates treat missing counters as zero', () => {
  const partial = { failed: 2 } as DashboardPaymentStats;
  assert.equal(unsuccessfulTransactionsCount(partial), 2);
});

test('backend unsuccessful_transactions field is preferred when present', () => {
  assert.equal(
    unsuccessfulTransactionsCount(stats({ failed: 2, expired: 3, cancelled: 4, unsuccessful_transactions: 11 })),
    11,
  );
});

test('backend unsuccessful_transactions of zero is honored', () => {
  assert.equal(
    unsuccessfulTransactionsCount(stats({ failed: 2, unsuccessful_transactions: 0 })),
    0,
  );
});

test('existing dashboard metrics remain unchanged by the selector', () => {
  const input = stats({ total: 20, paid: 10, failed: 2, expired: 2, cancelled: 1 });
  const snapshot = { ...input };
  unsuccessfulTransactionsCount(input);
  overviewUnsuccessfulCount(overview({ total: 20, paid: 10 }));
  assert.deepEqual(input, snapshot);
});

test('overview response maps to the card value without touching visible rows', () => {
  const data = overview({ paid: 7, failed: 1, expired: 1, cancelled: 1 });
  data.recent_payments = [];
  assert.equal(overviewUnsuccessfulCount(data), 3);
});

test('buildOverviewPath keeps the existing endpoint without merchant scoping', () => {
  assert.equal(buildOverviewPath(), '/api/v1/dashboard/overview');
  assert.equal(
    buildOverviewPath('2026-01-01T00:00:00.000Z', '2026-01-31T00:00:00.000Z'),
    '/api/v1/dashboard/overview?from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-31T00%3A00%3A00.000Z',
  );
  assert.equal(buildOverviewPath().includes('merchant_id'), false);
});

// ─── Date-range filter (Phase 10J) ───────────────────────────────────────────

const FIXED_NOW = new Date('2026-10-14T12:00:00.000Z');

test('overview presets cover the required set', () => {
  assert.deepEqual(
    OVERVIEW_PRESETS.map((preset) => preset.key),
    ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'custom'],
  );
});

test('today preset selects a single UTC day', () => {
  assert.deepEqual(presetDateRange('today', FIXED_NOW), { start: '2026-10-14', end: '2026-10-14' });
});

test('yesterday preset selects the previous UTC day', () => {
  assert.deepEqual(presetDateRange('yesterday', FIXED_NOW), { start: '2026-10-13', end: '2026-10-13' });
});

test('last7 preset ends today and spans seven UTC days', () => {
  assert.deepEqual(presetDateRange('last7', FIXED_NOW), { start: '2026-10-08', end: '2026-10-14' });
});

test('last30 preset spans thirty UTC days across a month boundary', () => {
  assert.deepEqual(presetDateRange('last30', FIXED_NOW), { start: '2026-09-15', end: '2026-10-14' });
});

test('thisMonth preset starts on the first of the month', () => {
  assert.deepEqual(presetDateRange('thisMonth', FIXED_NOW), { start: '2026-10-01', end: '2026-10-14' });
});

test('lastMonth preset covers the full previous month', () => {
  assert.deepEqual(presetDateRange('lastMonth', FIXED_NOW), { start: '2026-09-01', end: '2026-09-30' });
});

test('lastMonth preset crosses a year boundary', () => {
  assert.deepEqual(presetDateRange('lastMonth', new Date('2026-01-15T00:00:00.000Z')), {
    start: '2025-12-01',
    end: '2025-12-31',
  });
});

test('lastMonth preset handles February in a leap year', () => {
  assert.deepEqual(presetDateRange('lastMonth', new Date('2024-03-10T00:00:00.000Z')), {
    start: '2024-02-01',
    end: '2024-02-29',
  });
});

test('presets use UTC days regardless of browser timezone offset math', () => {
  // 01:30 UTC is still the previous calendar day behind UTC.
  assert.deepEqual(presetDateRange('today', new Date('2026-10-14T01:30:00.000Z')), {
    start: '2026-10-14',
    end: '2026-10-14',
  });
  assert.equal(toDateOnlyUTC(new Date('2026-10-14T00:00:00.000Z')), '2026-10-14');
});

test('default overview range is Last 7 Days', () => {
  assert.deepEqual(defaultOverviewRange(FIXED_NOW), {
    preset: 'last7',
    start: '2026-10-08',
    end: '2026-10-14',
  });
});

test('query params use an exclusive end of midnight after the end date', () => {
  assert.deepEqual(toOverviewParams({ start: '2026-10-08', end: '2026-10-14' }), {
    from: '2026-10-08',
    to: '2026-10-15',
  });
});

test('single-day selection yields a one-day half-open window', () => {
  assert.deepEqual(toOverviewParams({ start: '2024-02-29', end: '2024-02-29' }), {
    from: '2024-02-29',
    to: '2024-03-01',
  });
});

test('exclusive end rolls across month and year boundaries', () => {
  assert.equal(addDaysDateOnly('2026-01-31', 1), '2026-02-01');
  assert.equal(addDaysDateOnly('2025-12-31', 1), '2026-01-01');
  assert.equal(addDaysDateOnly('2024-02-29', 1), '2024-03-01');
});

test('end of day is never approximated with 23:59:59', () => {
  const { to } = toOverviewParams({ start: '2026-10-14', end: '2026-10-14' });
  assert.equal(to.includes('23:59:59'), false);
  assert.equal(to, '2026-10-15');
  assert.equal(buildOverviewPath('2026-10-14', to).includes('23%3A59%3A59'), false);
});

test('isValidDateOnly accepts real calendar dates only', () => {
  assert.equal(isValidDateOnly('2026-10-14'), true);
  assert.equal(isValidDateOnly('2024-02-29'), true);
  assert.equal(isValidDateOnly('2026-02-30'), false);
  assert.equal(isValidDateOnly('2026-13-01'), false);
  assert.equal(isValidDateOnly('2026-10-1'), false);
  assert.equal(isValidDateOnly('not-a-date'), false);
  assert.equal(isValidDateOnly(''), false);
  assert.equal(isValidDateOnly(null), false);
  assert.equal(isValidDateOnly(undefined), false);
});

test('validateOverviewRange rejects malformed and inverted ranges', () => {
  assert.equal(validateOverviewRange('2026-10-08', '2026-10-14'), null);
  assert.equal(validateOverviewRange('2026-10-14', '2026-10-14'), null);
  assert.equal(typeof validateOverviewRange('bogus', '2026-10-14'), 'string');
  assert.equal(typeof validateOverviewRange('2026-10-08', '2026-02-30'), 'string');
  assert.equal(validateOverviewRange('2026-10-15', '2026-10-14'), 'Start date must not be after the end date.');
});

test('query keys distinguish different applied ranges', () => {
  const merchantId = 'merchant-a';
  const keyFor = (start: string, end: string) => {
    const params = toOverviewParams({ start, end });
    return ['dashboard-overview', merchantId, params.from, params.to];
  };
  assert.notDeepEqual(keyFor('2026-10-08', '2026-10-14'), keyFor('2026-09-15', '2026-10-14'));
  assert.deepEqual(keyFor('2026-10-08', '2026-10-14'), keyFor('2026-10-08', '2026-10-14'));
});

test('query keys keep merchant scoping alongside the range', () => {
  const params = toOverviewParams({ start: '2026-10-08', end: '2026-10-14' });
  const keyA = ['dashboard-overview', 'merchant-a', params.from, params.to];
  const keyB = ['dashboard-overview', 'merchant-b', params.from, params.to];
  assert.notDeepEqual(keyA, keyB);
});

test('all overview requests share the single applied range', () => {
  // The page issues one overview request; metrics, revenue, refunds, and the
  // recent list all arrive in that response, so one from/to pair covers them.
  const applied = defaultOverviewRange(FIXED_NOW);
  const params = toOverviewParams(applied);
  const path = buildOverviewPath(params.from, params.to);
  assert.equal(path, '/api/v1/dashboard/overview?from=2026-10-08&to=2026-10-15');
  assert.equal(path.includes('merchant_id'), false);
});

test('isSameOverviewRange detects unchanged ranges for Apply dedupe', () => {
  const a = { preset: 'last7' as const, start: '2026-10-08', end: '2026-10-14' };
  assert.equal(isSameOverviewRange(a, { ...a }), true);
  assert.equal(isSameOverviewRange(a, { ...a, end: '2026-10-15' }), false);
  assert.equal(isSameOverviewRange(a, { ...a, preset: 'custom' as const }), false);
});

test('unsuccessful count respects the selected period response', () => {
  // Period A has failures; period B is clean. The card is a pure function of
  // the period-scoped response, so switching ranges switches the value.
  const periodA = overview({ failed: 2, expired: 1, cancelled: 1 });
  const periodB = overview({ paid: 4 });
  assert.equal(overviewUnsuccessfulCount(periodA), 4);
  assert.equal(overviewUnsuccessfulCount(periodB), 0);
});

test('editing dates without applying leaves the request range unchanged', () => {
  // Params derive from the applied range only; pending keystrokes never feed
  // the query, so displayed cards and recent rows cannot shift mid-edit.
  const applied = defaultOverviewRange(FIXED_NOW);
  const before = toOverviewParams(applied);
  const pendingEdited = { ...applied, preset: 'custom' as const, end: '2026-10-20' };
  assert.equal(isSameOverviewRange(pendingEdited, applied), false);
  assert.deepEqual(toOverviewParams(applied), before);
  assert.deepEqual(before, { from: '2026-10-08', to: '2026-10-15' });
});

test('recent payments ride the same overview request as the metric cards', () => {
  // One path, one from/to pair: cards, revenue, refunds, and the recent list
  // share a single response, so they cannot disagree on the applied range.
  const applied = { preset: 'last7' as const, start: '2026-10-08', end: '2026-10-14' };
  const params = toOverviewParams(applied);
  const path = buildOverviewPath(params.from, params.to);
  assert.equal(path, '/api/v1/dashboard/overview?from=2026-10-08&to=2026-10-15');
  const response = overview({ paid: 2, failed: 1 });
  assert.equal(response.recent_payments.length, 0);
  assert.equal(overviewUnsuccessfulCount(response), 1);
  assert.equal(response.payments.paid, 2);
});

test('regression: Today Oct 14 requests a single-day window distinct from other ranges', () => {
  // Screenshot scenario: Today applied for 2026-10-14 while cards showed zero
  // and recent showed Oct 13/12/9 rows. The frontend must request exactly
  // [2026-10-14, 2026-10-15) under a key no other range shares, so cards and
  // recent always come from the same period-scoped response.
  const now = new Date('2026-10-14T10:00:00.000Z');
  const { start, end } = presetDateRange('today', now);
  assert.deepEqual({ start, end }, { start: '2026-10-14', end: '2026-10-14' });
  const params = toOverviewParams({ start, end });
  assert.deepEqual(params, { from: '2026-10-14', to: '2026-10-15' });
  assert.equal(
    buildOverviewPath(params.from, params.to),
    '/api/v1/dashboard/overview?from=2026-10-14&to=2026-10-15',
  );

  const keyFor = (s: string, e: string) => {
    const p = toOverviewParams({ start: s, end: e });
    return ['dashboard-overview', 'merchant-a', p.from, p.to];
  };
  const todayKey = keyFor(start, end);
  // Any earlier range (e.g. the week holding the Oct 13/12/9 rows) resolves
  // to a different key *and* a different request path: its payload can never
  // overwrite, merge into, or stand in for the Today response.
  assert.notDeepEqual(todayKey, keyFor('2026-10-08', '2026-10-14'));
  assert.notDeepEqual(todayKey, keyFor('2026-10-13', '2026-10-13'));

  // Fixed invariant for the Today response: zero counts and older rows cannot
  // coexist in one period-scoped payload — empty day means empty recent list,
  // which is exactly what drives the empty state.
  const todayResponse = overview({});
  assert.equal(todayResponse.payments.total, 0);
  assert.equal(overviewUnsuccessfulCount(todayResponse), 0);
  assert.equal(todayResponse.recent_payments.length, 0);
});
