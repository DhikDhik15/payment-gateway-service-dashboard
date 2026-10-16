import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_ANALYTICS_KEY,
  dashboardAnalyticsQueryKey,
} from './analyticsQuery.ts';
import {
  DASHBOARD_OVERVIEW_PREFIX,
  DASHBOARD_PAYMENT_DETAIL_PREFIX,
  DASHBOARD_PAYMENTS_PREFIX,
  DASHBOARD_REFUNDS_PREFIX,
  SIMULATOR_PAYMENT_DETAIL_PREFIX,
  dashboardPaymentCreatedInvalidations,
  dashboardRefundCreatedInvalidations,
  simulatorTransitionInvalidations,
} from './invalidation.ts';
import { dashboardPaymentDetailQueryKey } from './paymentsQuery.ts';

function startsWith(key: readonly (string | undefined)[], prefix: readonly string[]): boolean {
  return prefix.every((segment, index) => key[index] === segment);
}

test('simulator transitions refresh the dashboard payment detail (F-04)', () => {
  const keys = simulatorTransitionInvalidations('tx-1');
  assert.ok(
    keys.some((prefix) => startsWith(dashboardPaymentDetailQueryKey('merchant-a', 'tx-1'), prefix)),
    'dashboard detail key must be covered by an invalidation prefix',
  );
  assert.ok(keys.some((prefix) => startsWith(['simulator-payment-detail', 'tx-1'], prefix)));
});

test('simulator transitions target only the transitioned payment in simulator scope', () => {
  const keys = simulatorTransitionInvalidations('tx-1');
  const simulatorPrefixes = keys.filter((prefix) => prefix[0] === SIMULATOR_PAYMENT_DETAIL_PREFIX);
  assert.deepEqual(simulatorPrefixes, [[SIMULATOR_PAYMENT_DETAIL_PREFIX, 'tx-1']]);
  assert.deepEqual(simulatorTransitionInvalidations('tx-2')[0], [SIMULATOR_PAYMENT_DETAIL_PREFIX, 'tx-2']);
});

test('payment creation and simulator transitions refresh analytics without colliding with overview (F-10)', () => {
  assert.equal(DASHBOARD_ANALYTICS_KEY, 'dashboard-analytics');
  for (const keys of [dashboardPaymentCreatedInvalidations(), simulatorTransitionInvalidations('tx-1')]) {
    assert.ok(keys.some((prefix) => prefix[0] === DASHBOARD_ANALYTICS_KEY));
    assert.ok(keys.some((prefix) => prefix[0] === DASHBOARD_OVERVIEW_PREFIX));
  }
  // Analytics prefixes match analytics keys across merchants and ranges...
  assert.ok(startsWith(dashboardAnalyticsQueryKey('merchant-a', '2026-10-08', '2026-10-15'), [DASHBOARD_ANALYTICS_KEY]));
  assert.ok(startsWith(dashboardAnalyticsQueryKey('merchant-b', '2026-09-15', '2026-10-15'), [DASHBOARD_ANALYTICS_KEY]));
  // ...but never overview keys: date-range filters stay namespaced.
  assert.equal(startsWith(['dashboard-overview', 'merchant-a', '2026-10-08', '2026-10-15'], [DASHBOARD_ANALYTICS_KEY]), false);
});

test('refunds leave analytics alone: refunds are a separate domain from paid revenue', () => {
  const keys = dashboardRefundCreatedInvalidations();
  assert.equal(keys.some((prefix) => prefix[0] === DASHBOARD_ANALYTICS_KEY), false);
  assert.deepEqual(keys, [
    [DASHBOARD_PAYMENTS_PREFIX],
    [DASHBOARD_PAYMENT_DETAIL_PREFIX],
    [DASHBOARD_REFUNDS_PREFIX],
    [DASHBOARD_OVERVIEW_PREFIX],
  ]);
});

test('invalidation prefixes are range-agnostic and carry no merchant identity', () => {
  const all = [
    ...dashboardPaymentCreatedInvalidations(),
    ...dashboardRefundCreatedInvalidations(),
    ...simulatorTransitionInvalidations('tx-1'),
  ];
  for (const prefix of all) {
    assert.ok(prefix.length <= 2, `prefix must stay a prefix: ${JSON.stringify(prefix)}`);
    assert.equal(prefix.some((segment) => segment.includes('merchant')), false);
    assert.equal(prefix.some((segment) => segment.includes('2026-')), false);
  }
});

test('payment creation covers list and overview with no unrelated refund traffic', () => {
  assert.deepEqual(dashboardPaymentCreatedInvalidations(), [
    [DASHBOARD_PAYMENTS_PREFIX],
    [DASHBOARD_OVERVIEW_PREFIX],
    [DASHBOARD_ANALYTICS_KEY],
  ]);
});
