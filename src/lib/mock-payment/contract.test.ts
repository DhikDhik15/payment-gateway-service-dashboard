import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMockPaymentPath,
  effectiveMockPaymentStatus,
  isMockPaymentPastExpiry,
  isMockPaymentResponse,
  mockPaymentRefetchInterval,
} from './contract.ts';
import type { MockPaymentResponse } from '@/types';

const pendingPayment: MockPaymentResponse = {
  reference: 'ORDER-11',
  amount: 50_000,
  currency: 'IDR',
  payment_method: 'QRIS',
  status: 'PENDING',
  expired_at: '2099-01-01T00:00:00.000Z',
  provider_transaction_id: 'MOCK-TXN-opaque',
  qris_payload: 'PAYGATE-MOCK-QRIS:MOCK-TXN-opaque',
};

test('public mock payment path keeps the identifier opaque and in the path', () => {
  assert.equal(
    buildMockPaymentPath('MOCK-TXN-opaque/value?x=1'),
    '/api/v1/mock-payments/MOCK-TXN-opaque%2Fvalue%3Fx%3D1',
  );
  assert.throws(() => buildMockPaymentPath(''), /identifier is required/);
});

test('public mock payment validation accepts the backend DTO and rejects malformed data', () => {
  assert.equal(isMockPaymentResponse(pendingPayment), true);
  assert.equal(isMockPaymentResponse({ ...pendingPayment, qris_payload: null }), true);
  assert.equal(isMockPaymentResponse({ ...pendingPayment, status: 'CANCELLED' }), false);
  assert.equal(isMockPaymentResponse({ ...pendingPayment, expired_at: 'not-a-date' }), false);
  assert.equal(isMockPaymentResponse({ ...pendingPayment, amount: 0 }), false);
  assert.equal(isMockPaymentResponse({ ...pendingPayment, qris_payload: 123 }), false);
});

test('a past expiry is an effective EXPIRED customer state without rewriting the DTO', () => {
  const payment = { ...pendingPayment, expired_at: '2020-01-01T00:00:00.000Z' };
  assert.equal(isMockPaymentPastExpiry(payment, Date.parse('2020-01-02T00:00:00.000Z')), true);
  assert.equal(effectiveMockPaymentStatus(payment, Date.parse('2020-01-02T00:00:00.000Z')), 'EXPIRED');
  assert.equal(payment.status, 'PENDING');
});

test('public mock payment polling is limited to non-expired PENDING payments', () => {
  const now = Date.parse('2020-01-02T00:00:00.000Z');
  assert.equal(mockPaymentRefetchInterval(pendingPayment, now), 3_000);
  assert.equal(mockPaymentRefetchInterval({ ...pendingPayment, status: 'PAID' }, now), false);
  assert.equal(mockPaymentRefetchInterval({ ...pendingPayment, status: 'FAILED' }, now), false);
  assert.equal(mockPaymentRefetchInterval({ ...pendingPayment, status: 'EXPIRED' }, now), false);
  assert.equal(mockPaymentRefetchInterval({ ...pendingPayment, expired_at: '2020-01-01T00:00:00.000Z' }, now), false);
  assert.equal(mockPaymentRefetchInterval(undefined, now), false);
});
