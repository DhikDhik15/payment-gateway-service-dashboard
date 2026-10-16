import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, publicApiClient, ApiClientError, setApiClientRefreshHandler, setApiClientSessionExpiredHandler, setApiClientTokenGetter } from './client.ts';

const originalFetch = globalThis.fetch;

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function restore() {
  globalThis.fetch = originalFetch;
  setApiClientRefreshHandler(null);
  setApiClientTokenGetter(null);
  setApiClientSessionExpiredHandler(null);
}

test.afterEach(restore);

test('central client returns the backend envelope and omits auth by default', async () => {
  globalThis.fetch = async () => response({ success: true, data: { ok: true } });
  const result = await apiClient.get<{ ok: boolean }>('/api/v1/dashboard/overview');
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { ok: true });
});

test('GET 401 refreshes once and retries with the replacement access token', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  setApiClientTokenGetter(() => 'old-access');
  setApiClientRefreshHandler(async () => 'new-access');
  let expired = false;
  setApiClientSessionExpiredHandler(() => { expired = true; });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (calls.length === 1) return response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }, 401);
    return response({ success: true, data: [] });
  };

  await apiClient.get('/api/v1/dashboard/payments');
  assert.equal(calls.length, 2);
  assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer old-access');
  assert.equal(new Headers(calls[1]?.init?.headers).get('authorization'), 'Bearer new-access');
  assert.equal(expired, false);
});

test('POST 401 is not automatically retried', async () => {
  let refreshCalls = 0;
  let requestCalls = 0;
  setApiClientTokenGetter(() => 'access');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'new-access'; });
  globalThis.fetch = async () => {
    requestCalls += 1;
    return response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }, 401);
  };

  await assert.rejects(() => apiClient.post('/api/v1/dashboard/payments', {}), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 401);
    return true;
  });
  assert.equal(requestCalls, 1);
  assert.equal(refreshCalls, 0);
});

test('public token-flow calls skip dashboard auth, refresh, and session expiry', async () => {
  let refreshCalls = 0;
  let expired = false;
  setApiClientTokenGetter(() => 'dashboard-token');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'new'; });
  setApiClientSessionExpiredHandler(() => { expired = true; });
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).has('authorization'), false);
    return response({ success: false, error: { code: 'INVITATION_NOT_FOUND', message: 'not found' } }, 404);
  };

  await assert.rejects(() => apiClient.get('/api/v1/invitations/token', { skipAuth: true, skipRefresh: true, credentials: 'omit' }));
  assert.equal(refreshCalls, 0);
  assert.equal(expired, false);
});

test('public API client never sends dashboard credentials or refresh handling', async () => {
  let authorization: string | null = 'unset';
  let apiKey: string | null = 'unset';
  let credentials: RequestCredentials | undefined;
  let refreshCalls = 0;
  setApiClientTokenGetter(() => 'dashboard-token');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'unexpected'; });
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    authorization = headers.get('authorization');
    apiKey = headers.get('x-api-key');
    credentials = init?.credentials;
    return response({ success: true, data: {} });
  };

  await publicApiClient.get('/api/v1/mock-payments/MOCK-TXN-test', {
    headers: { Authorization: 'Bearer must-not-leak', 'X-API-Key': 'must-not-leak' },
  });
  assert.equal(authorization, null);
  assert.equal(apiKey, null);
  assert.equal(credentials, 'omit');
  assert.equal(refreshCalls, 0);
});

test('terminal merchant lifecycle 401 reports a merchant-inactive session reason', async () => {
  let reason: string | undefined;
  setApiClientTokenGetter(() => 'access');
  setApiClientRefreshHandler(async () => null);
  setApiClientSessionExpiredHandler((value) => { reason = value; });
  globalThis.fetch = async () => response({ success: false, error: { code: 'MERCHANT_INACTIVE', message: 'inactive' } }, 401);
  await assert.rejects(() => apiClient.get('/api/v1/dashboard/settings'));
  assert.equal(reason, 'merchant_inactive');
});

test('logout sends the current bearer without automatic refresh handling', async () => {
  let authorization: string | null = null;
  let refreshCalls = 0;
  setApiClientTokenGetter(() => 'access-for-logout');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'unexpected'; });
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization');
    return response({ success: true, data: {} });
  };
  await apiClient.post('/api/v1/auth/logout', undefined, { skipRefresh: true, retryOnUnauthorized: false });
  assert.equal(authorization, 'Bearer access-for-logout');
  assert.equal(refreshCalls, 0);
});

test('malformed successful responses are rejected as INVALID_RESPONSE', async () => {
  globalThis.fetch = async () => new Response('<html>proxy error</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(() => apiClient.get('/api/v1/dashboard/settings'), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'INVALID_RESPONSE');
    return true;
  });
});

test('mutation 401 with retry opt-in refreshes once and retries the identical request', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let refreshCalls = 0;
  let expired = false;
  setApiClientTokenGetter(() => 'old-access');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'new-access'; });
  setApiClientSessionExpiredHandler(() => { expired = true; });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (calls.length === 1) return response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }, 401);
    return response({ success: true, data: { id: 'pay-1' } });
  };

  const result = await apiClient.post<{ id: string }>(
    '/api/v1/dashboard/payments',
    { amount: 10000 },
    { headers: { 'Idempotency-Key': 'key-abc' }, retryOnUnauthorized: true },
  );
  assert.deepEqual(result.data, { id: 'pay-1' });
  assert.equal(calls.length, 2);
  assert.equal(refreshCalls, 1);
  assert.equal(expired, false);
  // The retry re-sends the identical body and idempotency key with the new token.
  for (const call of calls) {
    assert.equal(new Headers(call.init?.headers).get('idempotency-key'), 'key-abc');
    assert.equal(call.init?.body, JSON.stringify({ amount: 10000 }));
  }
  assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer old-access');
  assert.equal(new Headers(calls[1]?.init?.headers).get('authorization'), 'Bearer new-access');
});

test('mutation retry happens at most once, then the session expires', async () => {
  let refreshCalls = 0;
  let requestCalls = 0;
  let expired = false;
  setApiClientTokenGetter(() => 'access');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'new-access'; });
  setApiClientSessionExpiredHandler(() => { expired = true; });
  globalThis.fetch = async () => {
    requestCalls += 1;
    return response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }, 401);
  };

  await assert.rejects(
    () => apiClient.post('/api/v1/dashboard/api-keys', { name: 'k' }, { retryOnUnauthorized: true }),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.status, 401);
      return true;
    },
  );
  assert.equal(requestCalls, 2);
  assert.equal(refreshCalls, 1);
  assert.equal(expired, true);
});

test('concurrent mutation 401s each retry exactly once with the refreshed token', async () => {
  const authorizations: Array<string | null> = [];
  let refreshCalls = 0;
  let requestCalls = 0;
  setApiClientTokenGetter(() => 'old-access');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'new-access'; });
  globalThis.fetch = async (_input, init) => {
    requestCalls += 1;
    if (requestCalls <= 2) return response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }, 401);
    authorizations.push(new Headers(init?.headers).get('authorization'));
    return response({ success: true, data: {} });
  };

  const options = { retryOnUnauthorized: true } as const;
  await Promise.all([
    apiClient.post('/api/v1/dashboard/products', { name: 'a' }, options),
    apiClient.post('/api/v1/dashboard/categories', { name: 'b' }, options),
  ]);
  assert.equal(requestCalls, 4);
  assert.ok(refreshCalls >= 1);
  assert.deepEqual(authorizations, ['Bearer new-access', 'Bearer new-access']);
});

test('mutation 401 with failed refresh ends the session without replaying', async () => {
  let requestCalls = 0;
  let expired = false;
  setApiClientTokenGetter(() => 'access');
  setApiClientRefreshHandler(async () => null);
  setApiClientSessionExpiredHandler(() => { expired = true; });
  globalThis.fetch = async () => {
    requestCalls += 1;
    return response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }, 401);
  };

  await assert.rejects(() => apiClient.post('/api/v1/dashboard/products', {}, { retryOnUnauthorized: true }));
  assert.equal(requestCalls, 1);
  assert.equal(expired, true);
});

test('transient refresh failure preserves the session and surfaces the original 401', async () => {
  let expired = false;
  let refreshCalls = 0;
  setApiClientTokenGetter(() => 'access');
  setApiClientRefreshHandler(async () => {
    refreshCalls += 1;
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Unable to reach the server.');
  });
  setApiClientSessionExpiredHandler(() => { expired = true; });
  globalThis.fetch = async () => response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }, 401);

  await assert.rejects(
    () => apiClient.post('/api/v1/dashboard/products', {}, { retryOnUnauthorized: true }),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.status, 401);
      return true;
    },
  );
  assert.equal(refreshCalls, 1);
  assert.equal(expired, false);
});

test('network failure on a mutation attempts no refresh and preserves the session', async () => {
  let refreshCalls = 0;
  let expired = false;
  setApiClientTokenGetter(() => 'access');
  setApiClientRefreshHandler(async () => { refreshCalls += 1; return 'new-access'; });
  setApiClientSessionExpiredHandler(() => { expired = true; });
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };

  await assert.rejects(
    () => apiClient.post('/api/v1/dashboard/products', {}, { retryOnUnauthorized: true }),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, 'NETWORK_ERROR');
      return true;
    },
  );
  assert.equal(refreshCalls, 0);
  assert.equal(expired, false);
});
