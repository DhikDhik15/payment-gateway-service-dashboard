import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage.tsx';
import { AuthContext } from '@/lib/auth';
import type { AuthContextValue } from '@/lib/auth';
import type { AuthUser, DashboardRole } from '@/types/auth';

function renderNotFound(options: { isAuthenticated: boolean; isLoading: boolean; role?: DashboardRole }): string {
  const user: AuthUser | null = options.role
    ? {
        id: 'user-1',
        merchant_id: 'merchant-1',
        email: 'teammate@example.com',
        role: options.role,
        status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
    : null;
  const state: AuthContextValue = {
    user,
    session: null,
    isAuthenticated: options.isAuthenticated,
    isLoading: options.isLoading,
    sessionExpired: false,
    sessionEndReason: null,
    restoreFailed: false,
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    retryRestore: () => undefined,
  };
  return renderToStaticMarkup(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/no-such-page']}>
        <NotFoundPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

test('unknown URL explains the problem without internal details', () => {
  const markup = renderNotFound({ isAuthenticated: true, isLoading: false, role: 'ADMIN' });
  assert.match(markup, /Page not found/);
  assert.match(markup, /does not exist/);
  assert.doesNotMatch(markup, /\/api\//);
  assert.doesNotMatch(markup, /no-such-page/);
});

test('authenticated users are offered the dashboard', () => {
  const markup = renderNotFound({ isAuthenticated: true, isLoading: false, role: 'VIEWER' });
  assert.match(markup, /Back to dashboard/);
  assert.match(markup, /href="\/dashboard"/);
});

test('unauthenticated users are offered login instead of a forced redirect', () => {
  const markup = renderNotFound({ isAuthenticated: false, isLoading: false });
  assert.match(markup, /Go to login/);
  assert.match(markup, /href="\/login"/);
});

test('loading auth offers the homepage while the destination resolves', () => {
  const markup = renderNotFound({ isAuthenticated: false, isLoading: true });
  assert.match(markup, /Go to homepage/);
  assert.match(markup, /href="\/"/);
});
