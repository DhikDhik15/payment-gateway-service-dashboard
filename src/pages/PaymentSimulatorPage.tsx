import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, CheckCircle2, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardTitle, CardContent, Label, Input, Button, Badge } from '@/components/ui';
import { useSimulatorCreatePayment } from '@/hooks/useSimulator';
import { setSimulatorApiKey } from '@/lib/simulator/credential';
import { formatCurrency } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/documentTitle';
import type { CreatePaymentResponse } from '@/types';

const simulatorSchema = z.object({ merchant_order_id: z.string().trim().min(1, 'Order ID is required').max(100), amount: z.coerce.number().int('Whole rupiah amounts only').positive('Amount must be positive'), currency: z.literal('IDR'), payment_method: z.literal('QRIS') });
type SimulatorFormValues = z.infer<typeof simulatorSchema>;
function newKey(): string { return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export default function PaymentSimulatorPage() {
  useDocumentTitle('Payment simulator');
  const navigate = useNavigate();
  const createMutation = useSimulatorCreatePayment();
  const [createdPayment, setCreatedPayment] = useState<CreatePaymentResponse | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const idempotencyKey = useRef(newKey());
  const [defaultOrderId] = useState(() => `ORDER-DEV-${Math.floor(100000 + Math.random() * 900000)}`);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SimulatorFormValues>({ resolver: zodResolver(simulatorSchema), defaultValues: { merchant_order_id: defaultOrderId, amount: 100000, currency: 'IDR', payment_method: 'QRIS' } });

  const submit = (values: SimulatorFormValues) => {
    if (!apiKey.trim()) { setCredentialError('Enter the development simulator API key. It is kept in memory only.'); return; }
    setCredentialError(null);
    setSimulatorApiKey(apiKey);
    createMutation.mutate({ body: values, idempotencyKey: idempotencyKey.current }, { onSuccess: setCreatedPayment, onError: () => setSimulatorApiKey('') });
  };

  const startOver = () => { setCreatedPayment(null); idempotencyKey.current = newKey(); createMutation.reset(); reset({ merchant_order_id: `ORDER-DEV-${Math.floor(100000 + Math.random() * 900000)}`, amount: 100000, currency: 'IDR', payment_method: 'QRIS' }); };

  return <div className="container mx-auto max-w-2xl space-y-8 px-4 py-10"><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground"><div className="flex items-center gap-1.5 font-medium"><ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />Development simulator (not production)</div><Link to="/login" className="font-semibold text-primary hover:underline">Go to dashboard →</Link></div><PageHeader title="Payment Simulator" description="Exercise the backend simulator in an explicitly enabled development environment." />{!createdPayment ? <Card className="border-2 border-dashed border-border"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Initiate simulator payment</CardTitle><p className="mt-1 text-sm text-muted-foreground">The backend assigns the configured simulator merchant. The dashboard never supplies a merchant ID.</p></div><Badge variant="warning">DEV ONLY</Badge></div></CardHeader><CardContent><form onSubmit={handleSubmit(submit)} className="space-y-5"><div className="space-y-2"><Label htmlFor="simulator-api-key" required>Simulator API key</Label><Input id="simulator-api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Enter only in this browser tab" /><p className="text-xs text-muted-foreground"><KeyRound className="mr-1 inline h-3 w-3" aria-hidden="true" />Memory-only development credential; never stored or logged.</p>{credentialError && <p className="text-sm text-danger" role="alert">{credentialError}</p>}</div><div className="space-y-2"><Label htmlFor="merchant_order_id" required>Merchant order ID</Label><Input id="merchant_order_id" {...register('merchant_order_id')} error={errors.merchant_order_id?.message} /></div><div className="space-y-2"><Label htmlFor="amount" required>Amount (IDR)</Label><Input id="amount" type="number" min="1" step="1" {...register('amount')} error={errors.amount?.message} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="currency">Currency</Label><Input id="currency" value="IDR" readOnly disabled /></div><div className="space-y-2"><Label htmlFor="payment_method">Payment method</Label><Input id="payment_method" value="QRIS" readOnly disabled /></div></div>{createMutation.isError && <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{(createMutation.error as Error)?.message ?? 'The simulator request could not be completed.'}</p></div>}<Button type="submit" className="w-full" isLoading={createMutation.isPending}>{createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Creating payment…</> : 'Create simulator payment'}</Button></form></CardContent></Card> : <Card className="border-2 border-success/30"><CardHeader className="border-b border-success/10 bg-success/5 pb-4"><div className="flex items-center gap-2 text-success"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /><div><CardTitle className="text-lg">Payment created</CardTitle><p className="text-xs text-muted-foreground">The simulator returned a pending development payment.</p></div></div></CardHeader><CardContent className="space-y-6 pt-6"><div className="grid grid-cols-2 gap-y-4 text-sm"><div className="text-muted-foreground">Payment ID</div><div className="break-all text-right font-mono font-semibold">{createdPayment.transaction_id}</div><div className="text-muted-foreground">Order ID</div><div className="text-right font-medium">{createdPayment.merchant_order_id}</div><div className="text-muted-foreground">Amount</div><div className="text-right font-semibold">{formatCurrency(createdPayment.amount, createdPayment.currency)}</div><div className="text-muted-foreground">Status</div><div className="text-right"><Badge variant="warning">{createdPayment.status}</Badge></div></div><div className="flex flex-col gap-3 border-t border-border pt-4"><Button onClick={() => { setSimulatorApiKey(apiKey); void navigate(`/checkout/${encodeURIComponent(createdPayment.transaction_id)}`); }} className="w-full gap-2">Open checkout simulation <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button><Button variant="outline" onClick={startOver} className="w-full">Create another payment</Button></div></CardContent></Card>}</div>;
}
