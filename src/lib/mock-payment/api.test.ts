import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClientError, setApiClientRefreshHandler, setApiClientTokenGetter } from '@/lib/api/client';
import { fetchPublicMockPayment, simulatePublicMockPayment } from './api.ts';

const originalFetch = globalThis.fetch;
const payment = {
  reference: 'ORDER-11',
  amount: 50_000,
  currency: 'IDR',
  payment_method: 'QRIS',
  status: 'PENDING' as const,
  expired_at: '2099-01-01T00:00:00.000Z',
  provider_transaction_id: 'MOCK-TXN-opaque',
  qris_payload: 'PAYGATE-MOCK-QRIS:MOCK-TXN-opaque',
};

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  setApiClientTokenGetter(null);
  setApiClientRefreshHandler(null);
});

test('public payment read uses the provider API and omits dashboard credentials', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  setApiClientTokenGetter(() => 'dashboard-jwt');
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return response(payment);
  };

  await fetchPublicMockPayment('MOCK-TXN-opaque');

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.url ?? '', /\/api\/v1\/mock-payments\/MOCK-TXN-opaque$/);
  assert.equal(new Headers(calls[0]?.init?.headers).has('authorization'), false);
  assert.equal(calls[0]?.init?.credentials, 'omit');
});

test('simulation actions call the real public success and failure endpoints', async () => {
  const calls: Array<{ url: string; method?: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method, init });
    return response({ ...payment, status: 'PAID' });
  };

  await simulatePublicMockPayment('MOCK-TXN-opaque', 'success');
  await simulatePublicMockPayment('MOCK-TXN-opaque', 'fail');

  assert.deepEqual(calls.map(({ url, method }) => ({ url, method })), [
    { url: '/api/v1/mock-payments/MOCK-TXN-opaque/success', method: 'POST' },
    { url: '/api/v1/mock-payments/MOCK-TXN-opaque/fail', method: 'POST' },
  ]);
  assert.equal(calls[0]?.init?.credentials, 'omit');
  assert.equal(calls[1]?.init?.credentials, 'omit');
});

test('malformed public payment responses are rejected without exposing the payload', async () => {
  globalThis.fetch = async () => response({ ...payment, amount: '50,000' });

  await assert.rejects(
    () => fetchPublicMockPayment('MOCK-TXN-opaque'),
    (error: unknown) => error instanceof ApiClientError && error.code === 'INVALID_RESPONSE',
  );
});

test('unknown public payment identifiers preserve a retry-safe 404 error', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    error: { code: 'TRANSACTION_NOT_FOUND', message: 'Payment not found' },
  }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  await assert.rejects(
    () => fetchPublicMockPayment('MOCK-TXN-unknown'),
    (error: unknown) => error instanceof ApiClientError && error.status === 404,
  );
});

test('public payment network failures are normalized for a retry-friendly UI', async () => {
  globalThis.fetch = async () => { throw new TypeError('offline'); };

  await assert.rejects(
    () => fetchPublicMockPayment('MOCK-TXN-opaque'),
    (error: unknown) => error instanceof ApiClientError && error.code === 'NETWORK_ERROR' && error.status === 0,
  );
});
