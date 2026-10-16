import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Clock, CheckCircle2, Undo2, ExternalLink, QrCode, Info } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  PaymentStatusBadge,
  SkeletonCard,
  ErrorState,
  Dialog,
  Input,
  Label,
  Badge,
} from '@/components/ui';
import { usePaymentDetail, useCreateRefund } from '@/hooks/usePayments';
import { ProductDetailsCard } from '@/components/payments/ProductDetailsCard';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage, fieldError, isErrorCode, isMerchantInactiveError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canIssueRefunds } from '@/lib/auth/permissions';
import { formatCurrency, formatDateTime, openPaymentPage, safeHttpUrl } from '@/lib/utils';

const refundSchema = z.object({
  amount: z.coerce.number().int('Amount must be a whole number').positive('Amount must be greater than 0'),
  reason: z.string().trim().max(255).optional(),
});
type RefundFormValues = z.infer<typeof refundSchema>;

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `refund-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Check if a URL points to the same origin as this dashboard.
 * This prevents a misconfigured backend payment_url from redirecting
 * users to a JSON endpoint or an unintended origin.
 */
function isFrontendOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const { data, isLoading, isError, error, refetch } = usePaymentDetail(id);
  const refundMutation = useCreateRefund(id ?? '');
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey());
  const form = useForm<RefundFormValues>({ resolver: zodResolver(refundSchema), defaultValues: { reason: '' } });

  const canRefund = canIssueRefunds(user?.role) && merchant?.status === 'ACTIVE';

  const openRefund = () => {
    if (!data || !canRefund) return;
    refundMutation.reset();
    form.reset({ reason: '' });
    setIsRefundOpen(true);
  };

  const startNewRefundOperation = () => {
    idempotencyKey.current = newIdempotencyKey();
    refundMutation.reset();
    form.reset({ reason: '' });
  };

  const submitRefund = (values: RefundFormValues) => {
    if (!data || !canRefund || refundMutation.isPending) return;
    refundMutation.mutate({ body: { ...values, currency: data.currency }, idempotencyKey: idempotencyKey.current }, {
      onSuccess: () => { idempotencyKey.current = newIdempotencyKey(); setIsRefundOpen(false); form.reset(); },
    });
  };

  if (isLoading) return <div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><SkeletonCard /><div className="grid grid-cols-1 gap-6 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div></div>;
  if (isError || !data) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    return <ErrorState title={status === 404 ? 'Payment not found' : 'Could not load payment'} description={status === 404 ? 'This payment does not exist or is not available to your merchant.' : errorMessage(error, 'The payment could not be loaded.')} onRetry={() => void refetch()} />;
  }

  const isQris = data.payment_method.toUpperCase() === 'QRIS';
  const returnedPaymentUrl = data.payment_url;
  // Validate the backend value for safe navigation, but keep the original
  // string when opening it. PaymentURL is an opaque backend contract value.
  // Additionally verify the URL points to the same origin as this dashboard so
  // a misconfigured backend cannot redirect users to a JSON endpoint.
  const paymentUrl = returnedPaymentUrl && safeHttpUrl(returnedPaymentUrl) && isFrontendOrigin(returnedPaymentUrl) ? returnedPaymentUrl : null;
  const isPending = data.status === 'CREATED' || data.status === 'PENDING';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to payments"><Link to="/dashboard/payments"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></Link></Button>
        <PageHeader title={`Payment ${data.merchant_order_id}`} description={data.transaction_id} />
      </div>

      {isPending && <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-sm text-info" role="status"><Clock className="h-4 w-4" aria-hidden="true" /> Status updates automatically while this payment is pending. <span className="text-xs">This page stops polling after a terminal status.</span></div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Transaction details</CardTitle><PaymentStatusBadge status={data.status} /></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div><dt className="text-sm font-medium text-muted-foreground">Amount</dt><dd className="mt-1 text-2xl font-bold">{formatCurrency(data.amount, data.currency)}</dd></div>
                <div><dt className="text-sm font-medium text-muted-foreground">Payment method</dt><dd className="mt-1 capitalize">{data.payment_method.toLowerCase()}</dd></div>
                <div><dt className="text-sm font-medium text-muted-foreground">Provider</dt><dd className="mt-1 text-sm">{data.provider ?? 'Not exposed'}</dd></div>
                <div><dt className="text-sm font-medium text-muted-foreground">Provider transaction ID</dt><dd className="mt-1 break-all font-mono text-sm">{data.provider_transaction_id ?? 'Not exposed'}</dd></div>
                <div><dt className="text-sm font-medium text-muted-foreground">Created at</dt><dd className="mt-1 text-sm">{formatDateTime(data.created_at)}</dd></div>
                <div><dt className="text-sm font-medium text-muted-foreground">Updated at</dt><dd className="mt-1 text-sm">{formatDateTime(data.updated_at)}</dd></div>
                {data.paid_at && <div><dt className="text-sm font-medium text-muted-foreground">Paid at</dt><dd className="mt-1 text-sm">{formatDateTime(data.paid_at)}</dd></div>}
                {data.expired_at && <div><dt className="text-sm font-medium text-muted-foreground">Expires at</dt><dd className="mt-1 text-sm">{formatDateTime(data.expired_at)}</dd></div>}
              </dl>
            </CardContent>
          </Card>

          {isQris && <QrisPaymentPanel payment={data} />}

          {data.order_items && data.order_items.length > 0 && (
            <ProductDetailsCard
              items={data.order_items}
              currency={data.currency}
              paymentTotal={data.amount}
            />
          )}

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              {data.timeline.length > 0 ? <div className="space-y-6">{data.timeline.map((event, index) => <div key={`${event.type}-${event.at}`} className="flex gap-4"><div className="flex flex-col items-center"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">{event.type === 'CREATED' ? <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}</div>{index < data.timeline.length - 1 && <div className="my-1 w-px flex-1 bg-border" />}</div><div className="pb-6"><p className="text-sm font-medium">{event.type}</p><p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">No timeline events are available.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.status === 'PAID' && <Button className="w-full" variant="outline" disabled={!canRefund} onClick={openRefund} title={!canRefund ? 'OWNER or ADMIN role and an active merchant are required' : undefined}><Undo2 className="mr-2 h-4 w-4" aria-hidden="true" /> Refund payment</Button>}
              {paymentUrl && <Button type="button" className="w-full" onClick={() => openPaymentPage(paymentUrl)}>
                {isPending ? 'Open payment page' : 'View payment page'} <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>}
              {!paymentUrl && returnedPaymentUrl && <p className="text-xs text-muted-foreground">The backend payment URL does not point to this dashboard origin and cannot be opened safely.</p>}
              {!paymentUrl && !returnedPaymentUrl && <p className="text-xs text-muted-foreground">The backend did not return a valid hosted payment URL for this payment.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payment reference</CardTitle></CardHeader>
            <CardContent><p className="break-all font-mono text-sm">{data.merchant_order_id}</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{data.transaction_id}</p></CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isRefundOpen} onClose={() => setIsRefundOpen(false)} title="Issue refund" description={`Creating a refund for ${data.merchant_order_id}.`}>
        <form onSubmit={form.handleSubmit(submitRefund)} className="space-y-4" noValidate>
          <div className="space-y-2"><Label htmlFor="refund-amount" required>Refund amount ({data.currency})</Label><Input id="refund-amount" type="number" min="1" step="1" {...form.register('amount')} error={form.formState.errors.amount?.message ?? fieldError(refundMutation.error, 'amount')} /><p className="text-[10px] text-muted-foreground">The backend calculates the available refundable balance and rejects over-refunds atomically.</p></div>
          <div className="space-y-2"><Label htmlFor="refund-reason">Reason (optional)</Label><Input id="refund-reason" placeholder="Customer requested cancellation" {...form.register('reason')} error={form.formState.errors.reason?.message ?? fieldError(refundMutation.error, 'reason')} /></div>
          {refundMutation.isError && <div className="space-y-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert"><p>{isMerchantInactiveError(refundMutation.error) ? 'The merchant is not active, so the refund was not created.' : errorMessage(refundMutation.error)}</p>{(isErrorCode(refundMutation.error, 'IDEMPOTENCY_KEY_REUSED') || isErrorCode(refundMutation.error, 'IDEMPOTENCY_IN_PROGRESS')) && <Button type="button" variant="outline" size="sm" onClick={startNewRefundOperation}>Start a new refund attempt</Button>}</div>}
          <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="ghost" onClick={() => setIsRefundOpen(false)}>Cancel</Button><Button type="submit" isLoading={refundMutation.isPending}>Confirm refund</Button></div>
        </form>
      </Dialog>
    </div>
  );
}

function QrisPaymentPanel({ payment }: { payment: { amount: number; currency: string; status: string; merchant_order_id: string; transaction_id: string; expired_at?: string | null } }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" aria-hidden="true" /> QRIS payment</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <Badge variant={payment.status === 'PAID' ? 'success' : payment.status === 'PENDING' || payment.status === 'CREATED' ? 'warning' : 'default'}>{payment.status}</Badge>
          <p className="mt-3 text-2xl font-bold">{formatCurrency(payment.amount, payment.currency)}</p>
          <p className="mt-1 text-sm font-medium">{payment.merchant_order_id}</p>
          {payment.expired_at && <p className="mt-1 text-xs text-muted-foreground">Expires {formatDateTime(payment.expired_at)}</p>}
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>The canonical dashboard response does not expose a raw QRIS payload. No placeholder QR is generated here; use the backend-provided payment URL when available.</span></div>
      </CardContent>
    </Card>
  );
}
