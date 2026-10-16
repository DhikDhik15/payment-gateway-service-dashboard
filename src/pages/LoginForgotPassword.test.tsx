import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './LoginPage.tsx';
import { AuthContext } from '@/lib/auth';
import type { AuthContextValue } from '@/lib/auth';

function renderLogin(): string {
  const state: AuthContextValue = {
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
  };
  return renderToStaticMarkup(
    <AuthContext.Provider value={state}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

test('login page links to forgot password', () => {
  const markup = renderLogin();
  assert.match(markup, /Forgot Password\?/);
  assert.match(markup, /href="\/forgot-password"/);
});
