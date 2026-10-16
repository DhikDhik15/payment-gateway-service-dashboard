import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute.tsx';
import { RestoreErrorScreen } from './RestoreErrorScreen.tsx';
import { AuthContext } from '@/lib/auth';
import type { AuthContextValue } from '@/lib/auth';

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

function renderWithAuth(element: ReactNode, state: AuthContextValue): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/dashboard']}>{element}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

test('restore screen explains the outage and offers retry plus sign-in', () => {
  const markup = renderWithAuth(<RestoreErrorScreen onRetry={() => undefined} />, authState({}));
  assert.match(markup, /Connection unavailable/);
  assert.match(markup, /Try again/);
  assert.match(markup, /href="\/login"/);
  assert.doesNotMatch(markup, /\/api\//);
});

test('failed restore renders the retry screen instead of bouncing to login', () => {
  const markup = renderWithAuth(
    <ProtectedRoute><p>Restricted dashboard content</p></ProtectedRoute>,
    authState({ restoreFailed: true }),
  );
  assert.match(markup, /Connection unavailable/);
  assert.match(markup, /Try again/);
  assert.doesNotMatch(markup, /Restricted dashboard content/);
});

test('ordinary unauthenticated access still redirects without the retry screen', () => {
  const markup = renderWithAuth(
    <ProtectedRoute><p>Restricted dashboard content</p></ProtectedRoute>,
    authState({}),
  );
  assert.doesNotMatch(markup, /Connection unavailable/);
  assert.doesNotMatch(markup, /Restricted dashboard content/);
});

test('authenticated users never see the retry screen', () => {
  const markup = renderWithAuth(
    <ProtectedRoute><p>Restricted dashboard content</p></ProtectedRoute>,
    authState({ isAuthenticated: true, restoreFailed: true }),
  );
  assert.match(markup, /Restricted dashboard content/);
  assert.doesNotMatch(markup, /Connection unavailable/);
});
