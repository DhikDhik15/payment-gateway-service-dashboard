import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForgotPasswordPage } from './ForgotPasswordPage.tsx';
import { ResetPasswordPage } from './ResetPasswordPage.tsx';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/password-reset/contract.ts';

function renderWithRouter(entry: string, element: React.ReactNode): string {
  const client = new QueryClient();
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

test('forgot-password page renders the email form', () => {
  const markup = renderWithRouter('/forgot-password', <ForgotPasswordPage />);
  assert.match(markup, /Forgot password/);
  assert.match(markup, /type="email"/);
  assert.match(markup, /Send reset link/);
  assert.match(markup, /Back to sign in/);
});

test('forgot-password schema accepts valid email and rejects invalid input', () => {
  assert.ok(forgotPasswordSchema.safeParse({ email: 'owner@example.com' }).success);
  assert.ok(!forgotPasswordSchema.safeParse({ email: '' }).success);
  assert.ok(!forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success);
});

test('reset-password page renders the new-password form when a token is present', () => {
  const markup = renderWithRouter('/reset-password?token=opaque-token', <ResetPasswordPage />);
  assert.match(markup, /Reset password/);
  assert.match(markup, /New password/);
  assert.match(markup, /Confirm new password/);
  // The token must never be rendered into the page.
  assert.doesNotMatch(markup, /opaque-token/);
});

test('reset-password page explains a missing link without a token', () => {
  const markup = renderWithRouter('/reset-password', <ResetPasswordPage />);
  assert.match(markup, /Reset link is missing/);
  assert.match(markup, /Request a new link/);
});

test('reset-password schema enforces policy and matching confirmation', () => {
  assert.ok(resetPasswordSchema.safeParse({ password: 'new-strong-pass', confirmPassword: 'new-strong-pass' }).success);
  const mismatch = resetPasswordSchema.safeParse({ password: 'new-strong-pass', confirmPassword: 'other-pass' });
  assert.ok(!mismatch.success);
  assert.ok(!resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }).success);
});

test('reset error messages stay generic and safe', async () => {
  const { resetErrorMessage } = await import('@/lib/password-reset/contract.ts');
  assert.match(resetErrorMessage('RESET_TOKEN_INVALID'), /invalid/i);
  assert.match(resetErrorMessage('RESET_TOKEN_EXPIRED'), /expired/i);
  assert.match(resetErrorMessage('RESET_TOKEN_CONSUMED'), /already been used/);
  assert.match(resetErrorMessage(undefined), /no longer available/);
});
