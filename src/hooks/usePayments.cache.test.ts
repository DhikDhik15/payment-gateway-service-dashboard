import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaymentsListPath,
  dashboardPaymentDetailQueryKey,
  dashboardPaymentsQueryKey,
} from './paymentsQuery.ts';
import { paymentRefetchInterval } from './usePayments.ts';

test('dashboardPaymentsQueryKey isolates merchants in the cache key', () => {
  const params = { page: 1, limit: 10 };
  const keyA = dashboardPaymentsQueryKey('merchant-a', params);
  const keyB = dashboardPaymentsQueryKey('merchant-b', params);

  assert.deepEqual(keyA, ['dashboard-payments', 'merchant-a', params]);
  assert.deepEqual(keyB, ['dashboard-payments', 'merchant-b', params]);
  assert.notDeepEqual(keyA, keyB);
});

test('buildPaymentsListPath rejects an unexpected merchant_id filter', () => {
  assert.throws(
    () => buildPaymentsListPath({ merchant_id: 'merchant-a' } as never),
    /Unsupported payment list filter/,
  );
});

test('buildPaymentsListPath never includes merchant_id', () => {
  const path = buildPaymentsListPath({
    page: 1,
    limit: 10,
    status: 'PENDING',
    search: 'ORDER-1',
  });

  assert.equal(
    path,
    '/api/v1/dashboard/payments?page=1&limit=10&status=PENDING&search=ORDER-1',
  );
  assert.equal(path.includes('merchant_id'), false);
  assert.equal(path.includes('merchant-a'), false);
});

test('payment polling runs only for non-terminal statuses', () => {
  assert.equal(paymentRefetchInterval('CREATED'), 5000);
  assert.equal(paymentRefetchInterval('PENDING'), 5000);
  assert.equal(paymentRefetchInterval('PAID'), false);
  assert.equal(paymentRefetchInterval('FAILED'), false);
  assert.equal(paymentRefetchInterval('EXPIRED'), false);
  assert.equal(paymentRefetchInterval('CANCELLED'), false);
  assert.equal(paymentRefetchInterval(undefined), false);
});

test('dashboardPaymentDetailQueryKey includes merchant for cache isolation only', () => {
  const key = dashboardPaymentDetailQueryKey('merchant-a', 'tx-1');
  assert.deepEqual(key, ['dashboard-payment-detail', 'merchant-a', 'tx-1']);
});
