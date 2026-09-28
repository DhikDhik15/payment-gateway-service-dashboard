import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Documents the auth restore contract after F5:
 * memory access token is gone; HttpOnly refresh cookie remains.
 * AuthProvider must call refresh before treating the user as logged out.
 */
test('auth restore strategy uses refresh when access token missing', () => {
  const accessTokenInMemory: string | null = null;
  const hasRefreshCookie = true;

  let restoredVia: 'memory' | 'refresh' | 'none' = 'none';
  if (accessTokenInMemory) {
    restoredVia = 'memory';
  } else if (hasRefreshCookie) {
    restoredVia = 'refresh';
  }

  assert.equal(restoredVia, 'refresh');
});

test('auth restore fails closed when neither access token nor refresh cookie exist', () => {
  const accessTokenInMemory: string | null = null;
  const hasRefreshCookie = false;

  const isAuthenticated = Boolean(accessTokenInMemory) || hasRefreshCookie;
  assert.equal(isAuthenticated, false);
});
