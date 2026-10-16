import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { RequireRole } from './RequireRole.tsx';
import { AuthContext } from '@/lib/auth';
import type { AuthContextValue } from '@/lib/auth';
import type { AuthUser } from '@/types/auth';
import { MANAGER_ROLES } from '@/lib/auth/permissions';

function userWithRole(role: AuthUser['role']): AuthUser {
  return {
    id: 'user-1',
    merchant_id: 'merchant-1',
    email: 'owner@example.com',
    role,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function authState(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: false,
    sessionExpired: false,
    sessionEndReason: null,
    restoreFailed: false,
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    retryRestore: () => undefined,
    ...overrides,
  };
}

// Note: <Navigate> performs its navigation in an effect, which never runs
// during server rendering, so denied states render no content here. Redirect
// targets are covered by the resolveRouteAccess unit tests and the route
// table test (fallback prop); these tests prove restricted content is never
// rendered for loading, unauthenticated, or unauthorized states.
function renderGuard(state: AuthContextValue, path = '/dashboard/payments/new'): string {
  const element: ReactNode = (
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={[path]}>
        <RequireRole allowedRoles={MANAGER_ROLES} fallback="/dashboard/payments">
          <p>Restricted payment creation content</p>
        </RequireRole>
      </MemoryRouter>
    </AuthContext.Provider>
  );
  return renderToStaticMarkup(element);
}

test('loading auth renders a loading page without restricted content', () => {
  const markup = renderGuard(authState({ isLoading: true, isAuthenticated: false }));
  assert.doesNotMatch(markup, /Restricted payment creation content/);
  assert.match(markup, /Loading/);
});

test('unauthenticated access renders no restricted content', () => {
  const markup = renderGuard(authState({ isAuthenticated: false }));
  assert.doesNotMatch(markup, /Restricted payment creation content/);
});

test('VIEWER navigating directly to the restricted route sees no content', () => {
  const markup = renderGuard(
    authState({ isAuthenticated: true, user: userWithRole('VIEWER') }),
  );
  assert.doesNotMatch(markup, /Restricted payment creation content/);
});

test('OWNER and ADMIN render the restricted route', () => {
  for (const role of ['OWNER', 'ADMIN'] as const) {
    const markup = renderGuard(
      authState({ isAuthenticated: true, user: userWithRole(role) }),
    );
    assert.match(markup, /Restricted payment creation content/, role);
  }
});
