import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
} from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { useCreatePayment } from '@/hooks/usePayments';
import { errorMessage, fieldError, isErrorCode, isMerchantInactiveError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const schema = z.object({
  merchant_order_id: z.string().trim().min(1, 'Merchant order ID is required').max(100, 'Maximum 100 characters'),
  amount: z.coerce.number().int('Amount must be a whole number').positive('Amount must be greater than zero'),
  currency: z.literal('IDR'),
  payment_method: z.literal('QRIS'),
});

type Values = z.infer<typeof schema>;

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CreatePaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const createMutation = useCreatePayment();
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { merchant_order_id: '', amount: 10000, currency: 'IDR', payment_method: 'QRIS' },
  });

  const merchantActive = merchant?.status === 'ACTIVE';
  const canCreate = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const submit = (values: Values) => {
    if (!canCreate || !merchantActive) return;
    createMutation.mutate(
      { body: values, idempotencyKey },
      {
        onSuccess: (payment) => {
          void navigate(`/dashboard/payments/${encodeURIComponent(payment.transaction_id)}`, {
            replace: true,
            state: { createdPayment: payment },
          });
        },
      },
    );
  };

  const resetOperation = () => {
    setIdempotencyKey(newIdempotencyKey());
    createMutation.reset();
    form.reset({ merchant_order_id: '', amount: 10000, currency: 'IDR', payment_method: 'QRIS' });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => void navigate('/dashboard/payments')} className="-ml-3">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to payments
      </Button>
      <PageHeader title="Create payment" description="Create a payment for the authenticated merchant." />

      {!canCreate && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Your VIEWER role is read-only. Ask an OWNER or ADMIN to create payments.
        </div>
      )}
      {!merchantActive && merchant && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Payment creation is unavailable while the merchant is {merchant.status.toLowerCase()}.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
          <CardDescription>Amounts are sent as integer minor units. The backend currently supports IDR and QRIS.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="merchant-order-id" required>Merchant order ID</Label>
              <Input id="merchant-order-id" autoComplete="off" placeholder="ORDER-2026-001" {...form.register('merchant_order_id')} error={form.formState.errors.merchant_order_id?.message ?? fieldError(createMutation.error, 'merchant_order_id')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount" required>Amount (IDR)</Label>
              <Input id="amount" type="number" min="1" step="1" inputMode="numeric" {...form.register('amount')} error={form.formState.errors.amount?.message ?? fieldError(createMutation.error, 'amount')} />
              <p className="text-xs text-muted-foreground">For example, 10000 is Rp10.000.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" value="IDR" readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-method">Payment method</Label>
                <Input id="payment-method" value="QRIS" readOnly disabled />
              </div>
            </div>

            {createMutation.isError && (
              <div className="space-y-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
                <p>{isErrorCode(createMutation.error, 'DUPLICATE_ORDER') ? 'A payment with this merchant order ID already exists.' : isErrorCode(createMutation.error, 'IDEMPOTENCY_KEY_REUSED') ? 'This retry key was already used with different payment details. Start a new operation only after checking the existing payment.' : isMerchantInactiveError(createMutation.error) ? 'The merchant is not active, so the payment was not created.' : errorMessage(createMutation.error)}</p>
                {isErrorCode(createMutation.error, 'IDEMPOTENCY_KEY_REUSED') && (
                  <Button type="button" variant="outline" size="sm" onClick={resetOperation}>Start a new operation</Button>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => void navigate('/dashboard/payments')} disabled={createMutation.isPending}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending} disabled={!canCreate || !merchantActive}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Create payment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">Current operation key is kept stable across retries. A new key is generated only when you explicitly start a new operation.</p>
    </div>
  );
}
