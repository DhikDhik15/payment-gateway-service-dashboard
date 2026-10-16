import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '@/lib/auth';
import type { AuthContextValue } from '@/lib/auth';
import type { AuthUser } from '@/types/auth';
import type { PaymentResponse, DashboardMerchantSettingsResponse } from '@/types';
import { PaymentsPage } from './PaymentsPage.tsx';
import { dashboardPaymentsQueryKey } from '@/hooks/paymentsQuery';

const merchantId = 'merchant-1';

function userWithRole(role: AuthUser['role']): AuthUser {
  return {
    id: 'user-1',
    merchant_id: merchantId,
    email: 'owner@example.com',
    role,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function authState(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
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

const settings: DashboardMerchantSettingsResponse = {
  id: merchantId,
  name: 'Acme Merchant',
  code: 'ACME',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  legacy_credential_state: 'MIGRATED',
};

const payments: PaymentResponse[] = [
  {
    transaction_id: 'txn-111',
    merchant_order_id: 'ORDER-001',
    amount: 50_000,
    currency: 'IDR',
    payment_method: 'QRIS',
    provider: 'Provider A',
    provider_transaction_id: 'prov-111',
    status: 'PAID',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z',
  },
  {
    transaction_id: 'txn-222',
    merchant_order_id: 'ORDER-002',
    amount: 25_000,
    currency: 'IDR',
    payment_method: 'QRIS',
    status: 'PENDING',
    created_at: '2026-01-09T10:00:00Z',
    updated_at: '2026-01-09T10:00:00Z',
  },
];

const paymentsEnvelope = {
  success: true,
  data: payments,
  meta: { page: 1, limit: 10, total: 2, total_pages: 1 },
};

function renderPage(
  auth: AuthContextValue,
  initial: { payments?: unknown; settings?: unknown } = {},
): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  if (initial.payments !== undefined) {
    queryClient.setQueryData(dashboardPaymentsQueryKey(merchantId, { page: 1, limit: 10 }), initial.payments);
  }
  if (initial.settings !== undefined) {
    queryClient.setQueryData(['dashboard-settings', merchantId], initial.settings);
  }
  return renderToStaticMarkup(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/payments']}>
          <PaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

test('PaymentsPage renders skeleton rows while the payments list is loading', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { settings });
  assert.match(markup, /animate-pulse/);
  assert.doesNotMatch(markup, /ORDER-001/);
  assert.doesNotMatch(markup, /Rp50\.000/);
});

test('PaymentsPage renders the transaction list when payments load successfully', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { payments: paymentsEnvelope, settings });
  assert.match(markup, /ORDER-001/);
  assert.match(markup, /ORDER-002/);
  assert.match(markup, /Rp[\s\u00a0]50\.000/);
  assert.match(markup, /Rp[\s\u00a0]25\.000/);
  assert.match(markup, /PAID/);
  assert.match(markup, /PENDING/);
  assert.match(markup, /qris/);
});

test('PaymentsPage links each transaction to its detail page', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { payments: paymentsEnvelope, settings });
  assert.match(markup, /\/dashboard\/payments\/txn-111/);
  assert.match(markup, /\/dashboard\/payments\/txn-222/);
});

test('PaymentsPage renders an empty state when there are no payments', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, {
    payments: { success: true, data: [], meta: { page: 1, limit: 10, total: 0, total_pages: 1 } },
    settings,
  });
  assert.match(markup, /No payments found/);
  assert.doesNotMatch(markup, /ORDER-001/);
});

test('PaymentsPage enables payment creation for OWNER and ADMIN on an active merchant', () => {
  for (const role of ['OWNER', 'ADMIN'] as const) {
    const auth = authState({ isAuthenticated: true, user: userWithRole(role) });
    const markup = renderPage(auth, { payments: paymentsEnvelope, settings });
    assert.match(markup, /Create payment/);
    assert.match(markup, /href="\/dashboard\/payments\/new"/);
  }
});

test('PaymentsPage renders a disabled create-payment button for a VIEWER role', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('VIEWER') });
  const markup = renderPage(auth, { payments: paymentsEnvelope, settings });
  assert.match(markup, /Create payment/);
  assert.match(markup, /disabled=""/);
  assert.doesNotMatch(markup, /href="\/dashboard\/payments\/new"/);
});

test('PaymentsPage disables payment creation when the merchant is not active', () => {
  const inactiveSettings = { ...settings, status: 'SUSPENDED' as const };
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { payments: paymentsEnvelope, settings: inactiveSettings });
  assert.match(markup, /Create payment/);
  assert.match(markup, /disabled=""/);
  assert.doesNotMatch(markup, /href="\/dashboard\/payments\/new"/);
});
