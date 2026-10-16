import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, ShieldAlert, KeyRound } from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Label,
} from '@/components/ui';
import {
  useSimulatorPaymentDetail,
  useSimulatorSuccess,
  useSimulatorFailure,
} from '@/hooks/useSimulator';
import { formatCurrency } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/documentTitle';
import { getSimulatorApiKey, setSimulatorApiKey } from '@/lib/simulator/credential';
import { isQrisPaymentMethod } from '@/lib/simulator/qr';
import { SimulatorQrCode } from '@/components/simulator/SimulatorQrCode';

export default function CheckoutSimulatorPage() {
  useDocumentTitle('Checkout simulator');
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();

  // Query details with automatic polling every 2 seconds if status is PENDING
  const {
    data: payment,
    isLoading,
    isError,
    error,
  } = useSimulatorPaymentDetail(paymentId);

  const successMutation = useSimulatorSuccess(paymentId || '');
  const failureMutation = useSimulatorFailure(paymentId || '');
  const [apiKey, setApiKey] = useState(getSimulatorApiKey() ?? '');
  const [credentialReady, setCredentialReady] = useState(!!getSimulatorApiKey());

  if (!credentialReady) {
    return (
      <div className="container mx-auto max-w-md px-4 py-20">
        <Card className="border-2 border-dashed border-border">
          <CardContent className="space-y-4 p-6 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold">Development credential required</h1>
            <p className="text-sm text-muted-foreground">Enter the simulator API key for this browser tab. It is kept in memory only and never placed in the URL.</p>
            <div className="space-y-2 text-left"><Label htmlFor="checkout-api-key">Simulator API key</Label><Input id="checkout-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" /></div>
            <Button className="w-full" onClick={() => { setSimulatorApiKey(apiKey); setCredentialReady(true); }} disabled={!apiKey.trim()}>Continue</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading checkout session...</p>
      </div>
    );
  }

  if (isError || !payment) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4 space-y-6">
        <Card className="border-2 border-danger/20 p-6 text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-danger/10 text-danger">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Checkout Failed</h2>
          <p className="text-sm text-muted-foreground">
            {(error as Error)?.message ?? 'The requested payment session was not found or has expired.'}
          </p>
          <Button onClick={() => navigate('/simulator')} className="w-full">
            Back to Payment Simulator
          </Button>
        </Card>
      </div>
    );
  }

  const isPending = payment.status === 'PENDING';
  const isPaid = payment.status === 'PAID';
  const isFailed = payment.status === 'FAILED';
  const isExpired = payment.status === 'EXPIRED';
  const isCancelled = payment.status === 'CANCELLED';
  const showQrisQr = isQrisPaymentMethod(payment.payment_method);
  const isMutating = successMutation.isPending || failureMutation.isPending;

  return (
    <div className="container max-w-md mx-auto py-10 px-4 space-y-8">
      {/* Dev environment notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-600 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Development Sandbox:</span> This is a mock checkout experience. No real money will be processed.
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Mock Payment Gateway</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Checkout Demo</h1>
      </div>

      <Card className="shadow-lg border-border">
        {/* State Banner */}
        {isPaid && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/15 p-4 flex items-center gap-3 text-emerald-600">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div className="text-xs font-semibold">Payment Successful</div>
          </div>
        )}
        {isFailed && (
          <div className="bg-danger/10 border-b border-destructive/15 p-4 flex items-center gap-3 text-danger">
            <XCircle className="h-5 w-5 shrink-0" />
            <div className="text-xs font-semibold">Payment Failed</div>
          </div>
        )}
        {isExpired && (
          <div className="bg-amber-500/10 border-b border-amber-500/15 p-4 flex items-center gap-3 text-amber-600">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div className="text-xs font-semibold">Payment Session Has Expired</div>
          </div>
        )}
        {isCancelled && (
          <div className="bg-muted p-4 flex items-center gap-3 text-muted-foreground border-b border-border">
            <XCircle className="h-5 w-5 shrink-0" />
            <div className="text-xs font-semibold">Payment Session Was Cancelled</div>
          </div>
        )}

        <CardContent className="pt-6 space-y-6">
          {/* Terminal success / failure primary state */}
          {isPaid && (
            <div className="flex flex-col items-center text-center space-y-2 py-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <p className="text-lg font-bold text-foreground">Payment Successful</p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {formatCurrency(payment.amount, payment.currency)}
              </p>
              <p className="text-sm font-semibold text-foreground">{payment.merchant_order_id}</p>
            </div>
          )}

          {isFailed && (
            <div className="flex flex-col items-center text-center space-y-2 py-2">
              <XCircle className="h-10 w-10 text-danger" />
              <p className="text-lg font-bold text-foreground">Payment Failed</p>
              <p className="text-sm text-muted-foreground">
                The simulated payment was rejected.
              </p>
              <p className="text-2xl font-extrabold tracking-tight text-foreground">
                {formatCurrency(payment.amount, payment.currency)}
              </p>
              <p className="text-sm font-semibold text-foreground">{payment.merchant_order_id}</p>
            </div>
          )}

          {/* QRIS simulation QR — only for QRIS; visible on PENDING and as record after terminal */}
          {showQrisQr && (
            <div className={isPaid || isFailed ? 'opacity-80 border-t border-border pt-6' : ''}>
              <SimulatorQrCode paymentId={payment.transaction_id} />
            </div>
          )}

          {/* Pending / non-terminal amount summary (avoid duplicating paid/failed hero) */}
          {!isPaid && !isFailed && (
            <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-xl border border-border/50 text-center space-y-2">
              {!showQrisQr && (
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {payment.payment_method}
                </span>
              )}
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {formatCurrency(payment.amount, payment.currency)}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {payment.merchant_order_id}
              </span>
              {showQrisQr && (
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {payment.payment_method}
                </span>
              )}
              <span className="text-xs text-muted-foreground font-mono bg-background px-2 py-0.5 rounded border border-border/40">
                ID: {payment.transaction_id.slice(0, 8)}...
              </span>
            </div>
          )}

          <div className="space-y-3.5 text-sm">
            {(isPaid || isFailed) && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-semibold text-foreground">{payment.merchant_order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(payment.amount, payment.currency)}
                  </span>
                </div>
              </>
            )}
            {!isPaid && !isFailed && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-semibold text-foreground">{payment.merchant_order_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span className="font-medium text-foreground">{payment.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium text-foreground">{payment.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span>
                <Badge
                  variant={
                    isPaid ? 'success' :
                    isFailed ? 'danger' :
                    isPending ? 'warning' : 'outline'
                  }
                >
                  {payment.status}
                </Badge>
              </span>
            </div>
          </div>

          {/* Action Triggers */}
          {isPending && (
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <Button
                onClick={() => successMutation.mutate()}
                disabled={isMutating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {successMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simulate Successful Payment
              </Button>
              <Button
                onClick={() => failureMutation.mutate()}
                disabled={isMutating}
                variant="danger"
                className="w-full"
              >
                {failureMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simulate Failed Payment
              </Button>
            </div>
          )}

          {/* Terminal navigation actions */}
          {!isPending && (
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <Button onClick={() => navigate('/simulator')} className="w-full">
                Create Another Payment
              </Button>
              <Link
                to="/login"
                className="text-xs font-semibold text-primary text-center hover:underline mt-2 inline-block"
              >
                Go to Merchant Dashboard
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {isPending && (
        <div className="text-center">
          <Link
            to="/simulator"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Simulator Form
          </Link>
        </div>
      )}
    </div>
  );
}
