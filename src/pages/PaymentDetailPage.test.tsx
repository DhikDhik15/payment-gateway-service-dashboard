import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '@/lib/auth';
import type { AuthContextValue } from '@/lib/auth';
import type { AuthUser } from '@/types/auth';
import type {
  DashboardPaymentDetailResponse,
  DashboardMerchantSettingsResponse,
} from '@/types';
import { PaymentDetailPage } from './PaymentDetailPage.tsx';
import { dashboardPaymentDetailQueryKey } from '@/hooks/paymentsQuery';

const merchantId = 'merchant-1';
const paymentId = 'txn-111';

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

function detail(overrides: Partial<DashboardPaymentDetailResponse> = {}): DashboardPaymentDetailResponse {
  return {
    transaction_id: paymentId,
    merchant_order_id: 'ORDER-001',
    amount: 50_000,
    currency: 'IDR',
    payment_method: 'QRIS',
    provider: 'Provider A',
    provider_transaction_id: 'prov-111',
    payment_url: `http://localhost:5173/pay/${paymentId}`,
    status: 'PAID',
    expired_at: '2026-02-10T10:00:00Z',
    paid_at: '2026-01-10T10:30:00Z',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:30:00Z',
    timeline: [
      { type: 'CREATED', at: '2026-01-10T10:00:00Z' },
      { type: 'PAID', at: '2026-01-10T10:30:00Z' },
    ],
    ...overrides,
  };
}

function renderPage(
  auth: AuthContextValue,
  initial: { detail?: unknown; settings?: unknown; windowOrigin?: string | null } = {},
): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  if (initial.detail !== undefined) {
    queryClient.setQueryData(dashboardPaymentDetailQueryKey(merchantId, paymentId), initial.detail);
  }
  if (initial.settings !== undefined) {
    queryClient.setQueryData(['dashboard-settings', merchantId], initial.settings);
  }
  let originalWindow: unknown;
  if (initial.windowOrigin !== null && initial.windowOrigin !== undefined) {
    originalWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window?: unknown }).window = {
      location: { origin: initial.windowOrigin },
    };
  }
  try {
    return renderToStaticMarkup(
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/dashboard/payments/${paymentId}`]}>
            <Routes>
              <Route path="/dashboard/payments/:id" element={<PaymentDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    );
  } finally {
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window?: unknown }).window = originalWindow;
    } else {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  }
}

test.afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

test('PaymentDetailPage renders skeletons while the detail is loading', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { settings });
  assert.match(markup, /animate-pulse/);
  assert.doesNotMatch(markup, /ORDER-001/);
});

test('PaymentDetailPage renders a paid payment detail', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { detail: detail({ status: 'PAID' }), settings });
  assert.match(markup, /ORDER-001/);
  assert.match(markup, /txn-111/);
  assert.match(markup, /Rp[\s\u00a0]50\.000/);
  assert.match(markup, /QRIS/);
  assert.match(markup, /Provider A/);
  assert.match(markup, /PAID/);
  assert.match(markup, /CREATED/);
  assert.match(markup, /Jan/);
});

test('PaymentDetailPage renders each terminal status without crashing', () => {
  for (const status of ['CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED'] as const) {
    const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
    const markup = renderPage(auth, { detail: detail({ status }), settings });
    assert.match(markup, new RegExp(status), `should render ${status}`);
  }
});

test('PaymentDetailPage renders the refund action for a paid payment', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { detail: detail({ status: 'PAID' }), settings });
  assert.match(markup, /Refund payment/);
  assert.doesNotMatch(markup, /disabled=""/);
});

test('PaymentDetailPage does not render the refund action for a non-paid payment', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { detail: detail({ status: 'PENDING' }), settings });
  assert.doesNotMatch(markup, /Refund payment/);
});

test('PaymentDetailPage disables the refund action for a VIEWER role', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('VIEWER') });
  const markup = renderPage(auth, { detail: detail({ status: 'PAID' }), settings });
  assert.match(markup, /Refund payment/);
  assert.match(markup, /disabled=""/);
});

test('PaymentDetailPage renders the QRIS panel when the payment method is QRIS', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { detail: detail({ payment_method: 'QRIS', status: 'PENDING' }), settings });
  assert.match(markup, /QRIS payment/);
  assert.match(markup, /Rp[\s\u00a0]50\.000/);
  assert.match(markup, /ORDER-001/);
  assert.match(markup, /does not expose a raw QRIS payload/);
  assert.match(markup, /Expires/);
});

test('PaymentDetailPage reports missing optional provider information', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { detail: detail({ provider: null }), settings });
  assert.match(markup, /Not exposed/);
});

test('PaymentDetailPage reports when the backend returns no payment URL', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, { detail: detail({ payment_url: null }), settings });
  assert.match(markup, /did not return a valid hosted payment URL/);
  assert.doesNotMatch(markup, /Open payment page/);
});

test('PaymentDetailPage reports an unsafe payment URL instead of opening it', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, {
    detail: detail({ payment_url: 'https://evil.example/pay/txn-111' }),
    settings,
    windowOrigin: 'http://localhost:5173',
  });
  assert.match(markup, /cannot be opened safely/);
  assert.doesNotMatch(markup, /Open payment page/);
});

test('PaymentDetailPage renders the open-payment-page button for a same-origin URL', () => {
  const auth = authState({ isAuthenticated: true, user: userWithRole('OWNER') });
  const markup = renderPage(auth, {
    detail: detail({ status: 'PENDING', payment_url: 'http://localhost:5173/pay/txn-111' }),
    settings,
    windowOrigin: 'http://localhost:5173',
  });
  assert.match(markup, /Open payment page/);
});
