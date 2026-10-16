import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  PaymentStatusBadge,
} from '@/components/ui';
import { LoadingPage } from '@/components/feedback';
import { MockPaymentQrCode } from '@/components/mock-payment/MockPaymentQrCode';
import {
  usePublicMockPayment,
  useSimulateMockPaymentFailure,
  useSimulateMockPaymentSuccess,
} from '@/hooks/useMockPayments';
import { errorMessage, isErrorCode, isStatus } from '@/lib/api';
import { effectiveMockPaymentStatus } from '@/lib/mock-payment';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/documentTitle';
import type { MockPaymentStatus } from '@/types';

function PublicPaymentShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-center gap-2">
          <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">P</div>
          <span className="text-lg font-semibold tracking-tight">PayGate</span>
          <Badge variant="warning">Mock Payment</Badge>
        </header>
        {children}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Development Payment Simulator · No real money is processed.
        </p>
      </div>
    </div>
  );
}

function statusMessage(status: MockPaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'Payment completed. The provider has marked this payment as paid.';
    case 'FAILED':
      return 'Payment failed. This simulated payment was not successful.';
    case 'EXPIRED':
      return 'This payment has expired and can no longer be paid.';
    case 'PENDING':
      return 'Payment is pending. Complete the development simulation to update the provider state.';
  }
}

function statusPanelClass(status: MockPaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'border-success/20 bg-success/5 text-success';
    case 'FAILED':
      return 'border-danger/20 bg-danger/5 text-danger';
    case 'EXPIRED':
      return 'border-warning/30 bg-warning/5 text-foreground';
    case 'PENDING':
      return 'border-info/20 bg-info/5 text-info';
  }
}

function statusIcon(status: MockPaymentStatus) {
  switch (status) {
    case 'PAID':
      return <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'FAILED':
      return <XCircle className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'EXPIRED':
      return <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'PENDING':
      return <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" />;
  }
}

function publicErrorDescription(error: unknown): string {
  if (isStatus(error, 404)) return 'Payment not found. Check the payment link and try again.';
  if (isErrorCode(error, 'INVALID_RESPONSE')) return 'The payment service returned invalid payment data. Please try again.';
  if (isStatus(error, 0)) return 'We could not reach the payment service. Check your connection and try again.';
  return errorMessage(error, 'The payment could not be loaded. Please try again.');
}

function simulationErrorMessage(error: unknown): string {
  if (isStatus(error, 400)) {
    return 'This payment could not be updated because its state changed. Refresh and try again.';
  }
  return errorMessage(error, 'The payment simulation could not be completed. Please try again.');
}

export function PublicPaymentPage() {
  useDocumentTitle('Complete payment');
  const { identifier } = useParams<{ identifier: string }>();
  const paymentQuery = usePublicMockPayment(identifier);
  const successMutation = useSimulateMockPaymentSuccess(identifier ?? '');
  const failureMutation = useSimulateMockPaymentFailure(identifier ?? '');
  const mutationError = successMutation.error ?? failureMutation.error;
  const isMutating = successMutation.isPending || failureMutation.isPending;

  if (!identifier) {
    return (
      <PublicPaymentShell>
        <ErrorState title="Payment not found" description="This payment link is missing a payment identifier." />
      </PublicPaymentShell>
    );
  }

  if (paymentQuery.isLoading) {
    return <PublicPaymentShell><LoadingPage /></PublicPaymentShell>;
  }

  if (paymentQuery.isError || !paymentQuery.data) {
    return (
      <PublicPaymentShell>
        <ErrorState
          title={isStatus(paymentQuery.error, 404) ? 'Payment not found' : 'Could not load payment'}
          description={publicErrorDescription(paymentQuery.error)}
          onRetry={() => void paymentQuery.refetch()}
        />
      </PublicPaymentShell>
    );
  }

  const payment = paymentQuery.data;
  const status = effectiveMockPaymentStatus(payment);
  const isPending = status === 'PENDING';
  const isQris = payment.payment_method.trim().toUpperCase() === 'QRIS';
  const qrisPayload = payment.qris_payload?.trim() ? payment.qris_payload : undefined;

  return (
    <PublicPaymentShell>
      <Card className="overflow-hidden">
        <div className={`flex items-start gap-3 border-b px-6 py-4 ${statusPanelClass(status)}`} role="status" aria-live="polite">
          {statusIcon(status)}
          <div>
            <p className="text-sm font-semibold">{status === 'PENDING' ? 'Payment pending' : status === 'PAID' ? 'Payment successful' : status === 'FAILED' ? 'Payment failed' : 'Payment expired'}</p>
            <p className="mt-0.5 text-xs opacity-90">{statusMessage(status)}</p>
          </div>
        </div>

        <CardHeader className="items-center text-center">
          <div className="flex w-full justify-center"><PaymentStatusBadge status={status} /></div>
          <CardTitle className="mt-2 break-words text-xl">Payment {payment.reference}</CardTitle>
          <p className="text-sm text-muted-foreground">Development payment details</p>
          <p className="mt-1 text-xs text-muted-foreground">Merchant name is not exposed by the public mock payment DTO.</p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/20 p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{formatCurrency(payment.amount, payment.currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{payment.currency} · {payment.payment_method}</p>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment method</dt>
              <dd className="mt-1 text-sm font-medium">{payment.payment_method}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment reference</dt>
              <dd className="mt-1 break-all text-sm">{payment.reference}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Provider transaction ID</dt>
              <dd className="mt-1 break-all font-mono text-xs">{payment.provider_transaction_id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment identifier</dt>
              <dd className="mt-1 break-all font-mono text-xs">{identifier}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiration</dt>
              <dd className="mt-1 text-sm">{formatDateTime(payment.expired_at)}</dd>
            </div>
          </dl>

          {isQris && (
            <section aria-labelledby="qris-heading" className="space-y-3 border-t border-border pt-6">
              <div className="text-center">
                <h2 id="qris-heading" className="text-base font-semibold">QRIS payment information</h2>
                <p className="mt-1 text-xs text-muted-foreground">Use the exact payload supplied by the development provider.</p>
              </div>
              {qrisPayload ? (
                <MockPaymentQrCode payload={qrisPayload} disabled={!isPending} />
              ) : (
                <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-center text-sm text-foreground" role="alert">
                  The provider did not return a QRIS payload. No replacement QR code was generated.
                </p>
              )}
            </section>
          )}

          {isPending && isQris && (
            <section aria-labelledby="payment-instructions-heading" className="space-y-3 border-t border-border pt-6">
              <div className="text-center">
                <h2 id="payment-instructions-heading" className="text-base font-semibold">Payment instructions</h2>
                <p className="mt-1 text-xs text-muted-foreground">Scan the QRIS code above using any supported e-money or mobile banking app.</p>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Open your preferred payment app.</li>
                <li>Scan the QRIS code displayed above.</li>
                <li>Verify the amount and merchant details.</li>
                <li>Complete the payment in your app.</li>
              </ol>
            </section>
          )}

          {isPending && (
            <section aria-labelledby="simulator-heading" className="space-y-3 border-t border-border pt-6">
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Development Simulator</p>
                  <p className="mt-1">These actions call the mock provider only. The provider event follows the normal webhook lifecycle; the merchant dashboard is not updated directly.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button type="button" onClick={() => successMutation.mutate()} disabled={isMutating} isLoading={successMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Simulate successful payment
                </Button>
                <Button type="button" variant="danger" onClick={() => failureMutation.mutate()} disabled={isMutating} isLoading={failureMutation.isPending}>
                  <XCircle className="h-4 w-4" aria-hidden="true" /> Simulate failed payment
                </Button>
              </div>
            </section>
          )}

          {mutationError && (
            <p className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
              {simulationErrorMessage(mutationError)}
            </p>
          )}

          {!isPending && (
            <div className="border-t border-border pt-5 text-center text-xs text-muted-foreground">
              This payment page is a development record and is no longer accepting simulation actions.
            </div>
          )}

          <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Provider state is refreshed from the backend after each simulation.
          </p>
        </CardContent>
      </Card>
    </PublicPaymentShell>
  );
}
