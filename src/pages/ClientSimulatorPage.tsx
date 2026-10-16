import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  ExternalLink,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  Input,
  Button,
  Badge,
  PaymentStatusBadge,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import {
  useClientCreatePayment,
  useClientPaymentDetail,
  useClientCancelPayment,
  useClientPayments,
} from '@/hooks/useClientSimulator';
import {
  setClientApiKey,
  getClientApiKey,
  clearClientApiKey,
} from '@/lib/client-simulator/credential';
import { openPaymentPage } from '@/lib/utils/url';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { useDocumentTitle } from '@/lib/documentTitle';
import { errorMessage, isErrorCode } from '@/lib/api/errors';
import { getReceiverEvents, type ReceiverEvent } from '@/lib/client-simulator/webhookReceiver';
import { useQuery } from '@tanstack/react-query';
import type { CreatePaymentResponse } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  merchant_order_id: z
    .string()
    .trim()
    .min(1, 'Order ID is required')
    .max(100),
  amount: z.coerce
    .number()
    .int('Whole rupiah amounts only')
    .positive('Amount must be positive'),
  currency: z.literal('IDR'),
  payment_method: z.literal('QRIS'),
});

type CreateFormValues = z.infer<typeof createSchema>;

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Connection Status ────────────────────────────────────────────────────────

type ConnectionStatus = 'not_connected' | 'connected' | 'auth_failed' | 'error';

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'not_connected':
      return 'Not Connected';
    case 'connected':
      return 'Connected';
    case 'auth_failed':
      return 'Authentication Failed';
    case 'error':
      return 'Connection Error';
  }
}

function statusVariant(status: ConnectionStatus): 'default' | 'success' | 'danger' | 'warning' {
  switch (status) {
    case 'not_connected':
      return 'default';
    case 'connected':
      return 'success';
    case 'auth_failed':
      return 'danger';
    case 'error':
      return 'warning';
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientSimulatorPage() {
  useDocumentTitle('Client simulator');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('not_connected');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [createdPayment, setCreatedPayment] = useState<CreatePaymentResponse | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  const createMutation = useClientCreatePayment();
  const cancelMutation = useClientCancelPayment(selectedPaymentId ?? '');
  const { data: paymentsData, isLoading: isLoadingPayments, error: paymentsError } = useClientPayments();
  const { data: selectedPayment, isLoading: isLoadingDetail } = useClientPaymentDetail(selectedPaymentId ?? undefined);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      merchant_order_id: `ORDER-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: 100000,
      currency: 'IDR',
      payment_method: 'QRIS',
    },
  });

  const handleConnect = () => {
    if (!apiKeyInput.trim()) return;
    setClientApiKey(apiKeyInput);
    setConnectionStatus('connected');
  };

  const handleDisconnect = () => {
    clearClientApiKey();
    setApiKeyInput('');
    setConnectionStatus('not_connected');
    setCreatedPayment(null);
    setSelectedPaymentId(null);
  };

  const submit = (values: CreateFormValues) => {
    if (!getClientApiKey()) {
      setConnectionStatus('not_connected');
      return;
    }
    createMutation.mutate(
      { body: values, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: (data) => {
          setCreatedPayment(data);
          setConnectionStatus('connected');
        },
        onError: (error) => {
          if (isErrorCode(error, 'INVALID_API_KEY', 'MERCHANT_INACTIVE')) {
            setConnectionStatus('auth_failed');
          } else {
            setConnectionStatus('error');
          }
        },
      },
    );
  };

  const startOver = () => {
    setCreatedPayment(null);
    idempotencyKey.current = newIdempotencyKey();
    createMutation.reset();
    reset({
      merchant_order_id: `ORDER-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: 100000,
      currency: 'IDR',
      payment_method: 'QRIS',
    });
  };

  const handleCancel = () => {
    if (!selectedPaymentId) return;
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        setSelectedPaymentId(null);
      },
    });
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
          External Merchant API Client
        </div>
        <Badge variant={statusVariant(connectionStatus)}>{statusLabel(connectionStatus)}</Badge>
      </div>

      <PageHeader
        title="Client Simulator"
        description="Simulate an external merchant application using the External Client API."
      />

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Enter your merchant API key. The key is stored in memory only and never persisted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-api-key" required>
                  API Key
                </Label>
                <Input
                  id="client-api-key"
                  type="password"
                  autoComplete="off"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="pk_xxx:sk_xxx"
                />
                <p className="text-xs text-muted-foreground">
                  <KeyRound className="mr-1 inline h-3 w-3" aria-hidden="true" />
                  Memory-only credential. Never stored, logged, or sent to any endpoint other than the
                  External Client API.
                </p>
              </div>
              <Button onClick={handleConnect} disabled={!apiKeyInput.trim()}>
                Connect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                <span className="font-medium">Connected</span>
                <span className="text-muted-foreground">
                  API key: {getClientApiKey()?.slice(0, 12)}…
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                <X className="mr-1 h-3 w-3" aria-hidden="true" />
                Disconnect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Payment */}
      {isConnected && !createdPayment && (
        <Card>
          <CardHeader>
            <CardTitle>Create Payment</CardTitle>
            <CardDescription>
              Create a new payment using the External Client API. The backend assigns the merchant from
              your API key.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(submit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="merchant_order_id" required>
                  Merchant Order ID
                </Label>
                <Input
                  id="merchant_order_id"
                  {...register('merchant_order_id')}
                  error={errors.merchant_order_id?.message}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" required>
                  Amount (IDR)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="1"
                  {...register('amount')}
                  error={errors.amount?.message}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" value="IDR" readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <Input id="payment_method" value="QRIS" readOnly disabled />
                </div>
              </div>
              {createMutation.isError && (
                <div
                  className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{errorMessage(createMutation.error)}</p>
                </div>
              )}
              <Button type="submit" className="w-full" isLoading={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Creating payment…
                  </>
                ) : (
                  'Create Payment'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Created Payment Result */}
      {isConnected && createdPayment && (
        <Card className="border-2 border-success/30">
          <CardHeader className="border-b border-success/10 bg-success/5 pb-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              <div>
                <CardTitle className="text-lg">Payment Created</CardTitle>
                <p className="text-xs text-muted-foreground">
                  The External Client API returned a pending payment.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="text-muted-foreground">Transaction ID</div>
              <div className="break-all text-right font-mono font-semibold">
                {createdPayment.transaction_id}
              </div>
              <div className="text-muted-foreground">Order ID</div>
              <div className="text-right font-medium">{createdPayment.merchant_order_id}</div>
              <div className="text-muted-foreground">Amount</div>
              <div className="text-right font-semibold">
                {formatCurrency(createdPayment.amount, createdPayment.currency)}
              </div>
              <div className="text-muted-foreground">Status</div>
              <div className="text-right">
                <PaymentStatusBadge status={createdPayment.status} />
              </div>
              {createdPayment.payment_url && (
                <>
                  <div className="text-muted-foreground">Payment URL</div>
                  <div className="text-right">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => openPaymentPage(createdPayment.payment_url)}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                      Open
                    </Button>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Button
                onClick={() => {
                  setSelectedPaymentId(createdPayment.transaction_id);
                  setCreatedPayment(null);
                }}
                className="w-full gap-2"
              >
                View Transaction
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" onClick={startOver} className="w-full">
                Create Another Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Detail */}
      {isConnected && selectedPaymentId && selectedPayment && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Transaction Detail</CardTitle>
                <CardDescription>
                  Live status from the External Client API.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPaymentId(null)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div className="text-muted-foreground">Transaction ID</div>
                  <div className="break-all text-right font-mono font-semibold">
                    {selectedPayment.transaction_id}
                  </div>
                  <div className="text-muted-foreground">Order ID</div>
                  <div className="text-right font-medium">{selectedPayment.merchant_order_id}</div>
                  <div className="text-muted-foreground">Amount</div>
                  <div className="text-right font-semibold">
                    {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                  </div>
                  <div className="text-muted-foreground">Currency</div>
                  <div className="text-right">{selectedPayment.currency}</div>
                  <div className="text-muted-foreground">Payment Method</div>
                  <div className="text-right">{selectedPayment.payment_method}</div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="text-right">
                    <PaymentStatusBadge status={selectedPayment.status} />
                  </div>
                  {selectedPayment.payment_url && (
                    <>
                      <div className="text-muted-foreground">Payment URL</div>
                      <div className="text-right">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => openPaymentPage(selectedPayment.payment_url)}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                          Open
                        </Button>
                      </div>
                    </>
                  )}
                  <div className="text-muted-foreground">Created At</div>
                  <div className="text-right">{formatDateTime(selectedPayment.created_at)}</div>
                  <div className="text-muted-foreground">Updated At</div>
                  <div className="text-right">{formatDateTime(selectedPayment.updated_at)}</div>
                </div>

                {/* Cancel button */}
                {(selectedPayment.status === 'CREATED' || selectedPayment.status === 'PENDING') && (
                  <div className="border-t border-border pt-4">
                    <Button
                      variant="danger"
                      onClick={handleCancel}
                      isLoading={cancelMutation.isPending}
                      className="w-full"
                    >
                      {cancelMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Cancelling…
                        </>
                      ) : (
                        'Cancel Payment'
                      )}
                    </Button>
                    {cancelMutation.isError && (
                      <p className="mt-2 text-sm text-danger" role="alert">
                        {errorMessage(cancelMutation.error)}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      {isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Client Transactions</CardTitle>
                <CardDescription>
                  Payments created through the External Client API.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  /* refetch handled by react-query */
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : paymentsError ? (
              <ErrorState
                title="Failed to load transactions"
                description={errorMessage(paymentsError)}
              />
            ) : !paymentsData?.length ? (
              <EmptyState
                title="No transactions yet"
                description="Create a payment to see it here."
              />
            ) : (
              <div className="space-y-2">
                {paymentsData.map((tx) => (
                  <button
                    key={tx.transaction_id}
                    onClick={() => setSelectedPaymentId(tx.transaction_id)}
                    className="flex w-full items-center justify-between rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm font-medium">
                        {tx.merchant_order_id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(tx.amount, tx.currency)} · {formatDateTime(tx.created_at)}
                      </div>
                    </div>
                    <PaymentStatusBadge status={tx.status} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Merchant Webhook Events */}
      {isConnected && <WebhookEventsSection />}
    </div>
  );
}

function WebhookEventsSection() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['receiver-events'],
    queryFn: getReceiverEvents,
    refetchInterval: 5000,
    retry: false,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Merchant Webhook Events</CardTitle>
            <CardDescription>
              Events received by the Mock Merchant Receiver. Polls every 5 seconds.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : error ? (
          <ErrorState
            title="Receiver unavailable"
            description="Ensure the Mock Merchant Receiver is running on port 9090."
          />
        ) : !data?.events?.length ? (
          <EmptyState
            title="No webhook events yet"
            description="Webhook events will appear here when the Mock Merchant Receiver receives them."
          />
        ) : (
          <div className="space-y-3">
            {data.events.map((event: ReceiverEvent) => (
              <div
                key={event.event_id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.signature_valid ? 'success' : 'danger'}>
                      {event.signature_valid ? 'VALID' : 'INVALID'}
                    </Badge>
                    <span className="font-mono text-sm font-medium">{event.event_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.received_at)}
                  </span>
                </div>
                {event.transaction_id && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Transaction: <span className="font-mono">{event.transaction_id}</span>
                  </div>
                )}
                {event.status && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Status: <span className="font-medium">{event.status}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
