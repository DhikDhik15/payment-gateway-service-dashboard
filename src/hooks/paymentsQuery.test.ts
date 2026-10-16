import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaymentsListPath,
  dashboardPaymentsQueryKey,
  toPaymentsDateRangeParams,
} from './paymentsQuery.ts';

test('toPaymentsDateRangeParams sends strict RFC3339 UTC-midnight bounds', () => {
  assert.deepEqual(toPaymentsDateRangeParams({ start: '2026-10-08', end: '2026-10-14' }), {
    created_from: '2026-10-08T00:00:00Z',
    created_to: '2026-10-15T00:00:00Z',
  });
});

test('toPaymentsDateRangeParams covers a single day without 23:59:59', () => {
  const params = toPaymentsDateRangeParams({ start: '2024-02-29', end: '2024-02-29' });
  assert.deepEqual(params, {
    created_from: '2024-02-29T00:00:00Z',
    created_to: '2024-03-01T00:00:00Z',
  });
  assert.equal(params.created_to?.includes('23:59:59'), false);
});

test('toPaymentsDateRangeParams rolls the exclusive end across year boundary', () => {
  assert.deepEqual(toPaymentsDateRangeParams({ start: '2025-12-30', end: '2025-12-31' }), {
    created_from: '2025-12-30T00:00:00Z',
    created_to: '2026-01-01T00:00:00Z',
  });
});

test('toPaymentsDateRangeParams omits bounds when unfiltered', () => {
  assert.deepEqual(toPaymentsDateRangeParams(null), {});
  assert.deepEqual(toPaymentsDateRangeParams(undefined), {});
});

test('buildPaymentsListPath composes date, status, search, and pagination', () => {
  const path = buildPaymentsListPath({
    page: 1,
    limit: 10,
    status: 'PAID',
    search: 'ORDER-1',
    ...toPaymentsDateRangeParams({ start: '2026-10-08', end: '2026-10-14' }),
  });
  assert.ok(path.startsWith('/api/v1/dashboard/payments?'), path);
  const query = new URLSearchParams(path.split('?')[1]);
  assert.equal(query.get('page'), '1');
  assert.equal(query.get('limit'), '10');
  assert.equal(query.get('status'), 'PAID');
  assert.equal(query.get('search'), 'ORDER-1');
  assert.equal(query.get('created_from'), '2026-10-08T00:00:00Z');
  assert.equal(query.get('created_to'), '2026-10-15T00:00:00Z');
  assert.ok(!query.has('merchant_id'), path);
});

test('buildPaymentsListPath omits date bounds when unfiltered', () => {
  const path = buildPaymentsListPath({ page: 1, limit: 10, status: 'PENDING' });
  const query = new URLSearchParams(path.split('?')[1]);
  assert.ok(!query.has('created_from'), path);
  assert.ok(!query.has('created_to'), path);
});

test('payment list query keys distinguish applied date ranges', () => {
  const base = { page: 1, limit: 10, status: 'PAID' } as const;
  const keyA = dashboardPaymentsQueryKey('merchant-a', {
    ...base,
    ...toPaymentsDateRangeParams({ start: '2026-10-08', end: '2026-10-14' }),
  });
  const keyB = dashboardPaymentsQueryKey('merchant-a', {
    ...base,
    ...toPaymentsDateRangeParams({ start: '2026-09-15', end: '2026-10-14' }),
  });
  const keySame = dashboardPaymentsQueryKey('merchant-a', {
    ...base,
    ...toPaymentsDateRangeParams({ start: '2026-10-08', end: '2026-10-14' }),
  });
  assert.notDeepEqual(keyA, keyB);
  assert.deepEqual(keyA, keySame);
});

test('payment list query keys carry page, status, search, and merchant scope', () => {
  const params = {
    page: 1,
    limit: 10,
    status: 'PAID',
    search: 'ORDER-1',
    ...toPaymentsDateRangeParams({ start: '2026-10-08', end: '2026-10-14' }),
  };
  const keyA = dashboardPaymentsQueryKey('merchant-a', params);
  const keyB = dashboardPaymentsQueryKey('merchant-b', params);
  assert.notDeepEqual(keyA, keyB);
  assert.deepEqual(keyA[0], 'dashboard-payments');
  assert.deepEqual(keyA[1], 'merchant-a');
  assert.deepEqual((keyA[2] as typeof params).page, 1);
  assert.deepEqual((keyA[2] as typeof params).status, 'PAID');
  assert.deepEqual((keyA[2] as typeof params).search, 'ORDER-1');
});
