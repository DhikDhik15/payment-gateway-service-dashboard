import test from 'node:test';
import assert from 'node:assert/strict';
import { authService, isRestoreFailure, tokenStorage } from './service.ts';
import { ApiClientError, apiClient } from '@/lib/api/client';

const originalFetch = globalThis.fetch;
const user = {
  id: 'user-1',
  merchant_id: 'merchant-1',
  email: 'owner@example.com',
  role: 'OWNER' as const,
  status: 'ACTIVE' as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data: body, meta: { request_id: 'req-test' } }), { status, headers: { 'Content-Type': 'application/json' } });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  authService.clearLocalSession();
});

test('login keeps the access token in memory and does not attach it to login', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (requests.length === 1) return json({});
    return json({ access_token: 'access-1', token_type: 'Bearer', expires_in: 900, user });
  };

  const session = await authService.login({ email: 'owner@example.com', password: 'correct horse battery staple' });
  assert.equal(session.token, 'access-1');
  assert.equal(session.user.role, 'OWNER');
  assert.equal(tokenStorage.get(), 'access-1');
  assert.equal(requests.length, 2);
  assert.equal(new Headers(requests[1]?.init?.headers).get('authorization'), null);
});

test('concurrent refresh calls share one refresh request', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return json({ access_token: 'access-2', token_type: 'Bearer', expires_in: 900, user });
  };

  const [first, second] = await Promise.all([authService.refreshSession(), authService.refreshSession()]);
  assert.equal(calls, 1);
  assert.equal(first?.token, 'access-2');
  assert.equal(second?.token, 'access-2');
});

test('late refresh response cannot restore memory after logout', async () => {
  let releaseRefresh!: () => void;
  let refreshCalls = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/api/v1/auth/refresh')) {
      refreshCalls += 1;
      return new Promise<Response>((resolve) => {
        releaseRefresh = () => resolve(json({ access_token: 'late-access', token_type: 'Bearer', expires_in: 900, user }));
      });
    }
    return json({});
  };
  tokenStorage.set('old-access', Date.now() + 60_000);
  const refreshPromise = authService.refreshSession();
  await Promise.resolve();
  const logoutPromise = authService.logout();
  const blockedRefresh = await authService.refreshSession();
  assert.equal(blockedRefresh, null);
  releaseRefresh();
  await refreshPromise;
  await logoutPromise;
  assert.equal(refreshCalls, 1);
  assert.equal(tokenStorage.get(), null);
  assert.equal(authService.getCurrentSession(), null);
});

test('late refresh from old account cannot overwrite a new login', async () => {
  const nextUser = { ...user, id: 'user-2', merchant_id: 'merchant-2', email: 'next@example.com' };
  let releaseRefresh!: () => void;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/api/v1/auth/refresh')) {
      return new Promise<Response>((resolve) => {
        releaseRefresh = () => resolve(json({ access_token: 'old-late-access', token_type: 'Bearer', expires_in: 900, user }));
      });
    }
    if (String(input).endsWith('/api/v1/auth/login')) {
      return json({ access_token: 'new-access', token_type: 'Bearer', expires_in: 900, user: nextUser });
    }
    return json({});
  };
  tokenStorage.set('old-access', Date.now() + 60_000);
  const refreshPromise = authService.refreshSession();
  await Promise.resolve();
  const loginPromise = authService.login({ email: nextUser.email, password: 'correct horse battery staple' });
  releaseRefresh();
  await refreshPromise;
  const session = await loginPromise;
  assert.equal(session.token, 'new-access');
  assert.equal(tokenStorage.get(), 'new-access');
  assert.equal(authService.getCurrentSession()?.user.id, 'user-2');
});

test('refresh failure returns null and clears the in-memory token', async () => {
  tokenStorage.set('stale', Date.now() + 60_000);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const session = await authService.refreshSession();
  assert.equal(session, null);
  assert.equal(tokenStorage.get(), null);
});

test('logout failure is surfaced after local state is cleared', async () => {
  tokenStorage.set('access-4', Date.now() + 60_000);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'unavailable' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(() => authService.logout());
  assert.equal(tokenStorage.get(), null);
});

test('post-logout refresh cannot restore the invalidated session', async () => {
  tokenStorage.set('access-post-logout', Date.now() + 60_000);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return json({});
    return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'revoked' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  };
  await authService.logout();
  const restored = await authService.refreshSession();
  assert.equal(restored, null);
  assert.equal(tokenStorage.get(), null);
});

test('logout calls the server with the memory bearer and always clears local access state', async () => {
  tokenStorage.set('access-3', Date.now() + 60_000);
  let called = false;
  let authorization: string | null = null;
  globalThis.fetch = async (_input, init) => {
    called = true;
    authorization = new Headers(init?.headers).get('authorization');
    return json({});
  };
  await authService.logout();
  assert.equal(called, true);
  assert.equal(authorization, 'Bearer access-3');
  assert.equal(tokenStorage.get(), null);
});

test('concurrent mutation 401s share one backend refresh and both succeed', async () => {
  tokenStorage.set('stale-access', Date.now() + 60_000);
  const calls: string[] = [];
  const retryAuthorizations: Array<string | null> = [];
  const errorBody = JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'expired' } });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/api/v1/auth/refresh')) {
      return json({ access_token: 'fresh-access', token_type: 'Bearer', expires_in: 900, user });
    }
    if (new Headers(init?.headers).get('authorization') === 'Bearer stale-access') {
      return new Response(errorBody, { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    retryAuthorizations.push(new Headers(init?.headers).get('authorization'));
    return json({ ok: true });
  };

  const [first, second] = await Promise.all([
    apiClient.post('/api/v1/dashboard/products', { name: 'a' }, { retryOnUnauthorized: true }),
    apiClient.post('/api/v1/dashboard/categories', { name: 'b' }, { retryOnUnauthorized: true }),
  ]);
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(calls.filter((url) => url.endsWith('/api/v1/auth/refresh')).length, 1);
  assert.deepEqual(retryAuthorizations, ['Bearer fresh-access', 'Bearer fresh-access']);
  assert.equal(tokenStorage.get(), 'fresh-access');
});

test('getSession network failure rethrows without clearing the memory token', async () => {
  tokenStorage.set('access-net', Date.now() + 60_000);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(() => authService.getSession(), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'NETWORK_ERROR');
    return true;
  });
  assert.equal(tokenStorage.get(), 'access-net');
});

test('restore failure classification distinguishes transport failure from auth rejection', () => {
  assert.equal(isRestoreFailure(new ApiClientError(401, 'INVALID_CREDENTIALS', 'expired')), false);
  assert.equal(isRestoreFailure(new ApiClientError(0, 'NETWORK_ERROR', 'unreachable')), true);
  assert.equal(isRestoreFailure(new ApiClientError(0, 'REQUEST_TIMEOUT', 'timed out')), true);
  assert.equal(isRestoreFailure(new ApiClientError(500, 'REQUEST_FAILED', 'server error')), true);
  assert.equal(isRestoreFailure(new TypeError('fetch failed')), true);
});
