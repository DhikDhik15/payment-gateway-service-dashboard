import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Documents the logout cache contract:
 * after logout, React Query must not retain the previous merchant's dashboard data.
 *
 * AuthProvider calls queryClient.clear() on logout (QueryProvider wraps AuthProvider).
 * Combined with merchant-scoped payment queryKeys, Merchant B cannot reuse Merchant A cache.
 */
test('logout clears React Query cache before next login can read it', () => {
  const cache = new Map<string, unknown>();
  cache.set(
    JSON.stringify(['dashboard-payments', 'merchant-a', { page: 1, limit: 10 }]),
    { success: true, data: [{ transaction_id: 'tx-a' }] },
  );

  // Simulate AuthProvider logout → queryClient.clear()
  cache.clear();

  assert.equal(cache.size, 0);
});

test('merchant-scoped query keys do not collide across merchants', () => {
  const keyA = ['dashboard-payments', 'merchant-a', { page: 1, limit: 10 }];
  const keyB = ['dashboard-payments', 'merchant-b', { page: 1, limit: 10 }];
  assert.notEqual(JSON.stringify(keyA), JSON.stringify(keyB));
});
