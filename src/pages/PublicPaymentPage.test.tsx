import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicPaymentPage } from './PublicPaymentPage.tsx';
import { mockPaymentQueryKey } from '@/hooks/useMockPayments';
import type { MockPaymentResponse } from '@/types';

const identifier = 'MOCK-TXN-opaque';
const payment: MockPaymentResponse = {
  reference: 'ORDER-11',
  amount: 50_000,
  currency: 'IDR',
  payment_method: 'QRIS',
  status: 'PENDING',
  expired_at: '2099-01-01T00:00:00.000Z',
  provider_transaction_id: identifier,
  qris_payload: 'PAYGATE-MOCK-QRIS:MOCK-TXN-opaque',
};

function renderPage(value: MockPaymentResponse): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(mockPaymentQueryKey(identifier), value);
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/pay/${identifier}`]}>
        <Routes>
          <Route path="/pay/:identifier" element={<PublicPaymentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('public payment route renders backend amount, status, and exact QRIS payload', () => {
  const markup = renderPage(payment);

  assert.match(markup, /Rp[\s\u00a0]50\.000/);
  assert.match(markup, /PENDING/);
  assert.match(markup, /PAYGATE-MOCK-QRIS:MOCK-TXN-opaque/);
  assert.match(markup, /Development Simulator/);
  assert.match(markup, /Simulate successful payment/);
});

test('terminal public payment state does not expose simulation actions', () => {
  const markup = renderPage({ ...payment, status: 'PAID' });

  assert.match(markup, /Payment successful/);
  assert.doesNotMatch(markup, /Simulate successful payment/);
  assert.doesNotMatch(markup, /Simulate failed payment/);
});

test('a pending payment past its backend expiry is presented as expired', () => {
  const markup = renderPage({ ...payment, expired_at: '2020-01-01T00:00:00.000Z' });

  assert.match(markup, /Payment expired/);
  assert.match(markup, /This payment has expired/);
  assert.doesNotMatch(markup, /Simulate successful payment/);
});

function renderPageWithClient(
  value: MockPaymentResponse | undefined,
  client: QueryClient,
): string {
  if (value !== undefined) {
    client.setQueryData(mockPaymentQueryKey(identifier), value);
  }
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/pay/${identifier}`]}>
        <Routes>
          <Route path="/pay/:identifier" element={<PublicPaymentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('public payment page shows a loading state while data is being fetched', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderPageWithClient(undefined, client);
  assert.match(markup, /Loading…/);
  assert.doesNotMatch(markup, /ORDER-11/);
});

test('public payment page reports a missing QRIS payload without fabricating one', () => {
  const markup = renderPage({ ...payment, qris_payload: null });
  assert.match(markup, /QRIS payment information/);
  assert.match(markup, /did not return a QRIS payload/);
  assert.doesNotMatch(markup, /PAYGATE-MOCK-QRIS/);
});

test('public payment page hides simulation actions for a non-pending terminal state', () => {
  for (const status of ['PAID', 'FAILED', 'EXPIRED'] as const) {
    const markup = renderPage({ ...payment, status });
    assert.doesNotMatch(markup, /Simulate successful payment/);
    assert.doesNotMatch(markup, /Simulate failed payment/);
  }
});
