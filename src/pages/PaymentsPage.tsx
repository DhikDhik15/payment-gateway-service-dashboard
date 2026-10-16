import { useState } from 'react';
import { CreditCard, Search, Filter, Eye, Plus, CalendarDays } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  DataTable,
  PaymentStatusBadge,
  Input,
  Button,
  Label,
  SkeletonRow,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { usePayments } from '@/hooks/usePayments';
import { toPaymentsDateRangeParams } from '@/hooks/paymentsQuery';
import {
  OVERVIEW_PRESETS,
  isSameOverviewRange,
  presetDateRange,
  validateOverviewRange,
} from '@/hooks/overviewQuery';
import type { OverviewAppliedRange, OverviewPresetKey } from '@/hooks/overviewQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canCreatePayments } from '@/lib/auth/permissions';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { listTotalPages, type PaymentResponse } from '@/types';
import { Link } from 'react-router-dom';

function paymentListErrorCopy(error: unknown): { title: string; description: string } {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  if (status === 401) return { title: 'Session expired', description: 'Your session is no longer valid. Please sign in again.' };
  if (status === 403) return { title: 'Permission denied', description: 'You do not have permission to view payments.' };
  if (status === 404) return { title: 'Payments unavailable', description: 'The payments resource could not be found.' };
  if (status === 429) return { title: 'Rate limit reached', description: 'Too many requests were made. Wait briefly before trying again.' };
  if (status >= 500) return { title: 'Unable to load payments', description: 'The service is temporarily unavailable. Please try again.' };
  return { title: 'Unable to load payments', description: errorMessage(error, 'Something went wrong while loading payments.') };
}

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  // Date filter mirrors the Overview filter behavior, with independent state:
  // null means the established unfiltered list. Pending edits never fetch
  // until Apply commits them.
  const [appliedDate, setAppliedDate] = useState<OverviewAppliedRange | null>(null);
  const [pendingPreset, setPendingPreset] = useState<OverviewPresetKey>('last7');
  const [pendingStart, setPendingStart] = useState(() => presetDateRange('last7').start);
  const [pendingEnd, setPendingEnd] = useState(() => presetDateRange('last7').end);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const canCreate = canCreatePayments(user?.role);
  // created_from/to are part of the query key, so each applied range caches
  // separately and a slow response for an old range cannot overwrite the new one.
  const dateParams = toPaymentsDateRangeParams(appliedDate);
  const { data, isLoading, isError, error, refetch } = usePayments({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    status: status || undefined,
    ...dateParams,
  });

  const appliedPresetLabel = appliedDate
    ? (OVERVIEW_PRESETS.find((preset) => preset.key === appliedDate.preset)?.label ?? 'Custom')
    : null;
  const pendingDirty =
    rangeError === null &&
    appliedDate !== null &&
    !isSameOverviewRange(
      { preset: pendingPreset, start: pendingStart, end: pendingEnd },
      appliedDate,
    );

  const selectPreset = (preset: OverviewPresetKey) => {
    setPendingPreset(preset);
    setRangeError(null);
    if (preset !== 'custom') {
      const { start, end } = presetDateRange(preset);
      setPendingStart(start);
      setPendingEnd(end);
    }
  };

  const handleCustomDateChange = (which: 'start' | 'end', value: string) => {
    setPendingPreset('custom');
    setRangeError(null);
    if (which === 'start') setPendingStart(value);
    else setPendingEnd(value);
  };

  const applyRange = () => {
    const validationError = validateOverviewRange(pendingStart, pendingEnd);
    if (validationError) {
      setRangeError(validationError);
      return;
    }
    setRangeError(null);
    const next: OverviewAppliedRange = { preset: pendingPreset, start: pendingStart, end: pendingEnd };
    // Identical key → React Query serves cache; no duplicate request.
    if (!appliedDate || !isSameOverviewRange(next, appliedDate)) setAppliedDate(next);
    setPage(1);
  };

  const resetRange = () => {
    const { start, end } = presetDateRange('last7');
    setAppliedDate(null);
    setPendingPreset('last7');
    setPendingStart(start);
    setPendingEnd(end);
    setRangeError(null);
    setPage(1);
  };

  const columns = [
    { key: 'transaction_id', header: 'ID', render: (p: PaymentResponse) => <span className="font-mono text-xs text-muted-foreground">{p.transaction_id.slice(0, 8)}…</span> },
    { key: 'order_id', header: 'Order ID', render: (p: PaymentResponse) => <span className="font-medium">{p.merchant_order_id}</span> },
    { key: 'amount', header: 'Amount', render: (p: PaymentResponse) => formatCurrency(p.amount, p.currency) },
    { key: 'method', header: 'Method', render: (p: PaymentResponse) => <span className="capitalize">{p.payment_method.toLowerCase()}</span> },
    { key: 'status', header: 'Status', render: (p: PaymentResponse) => <PaymentStatusBadge status={p.status} /> },
    { key: 'created_at', header: 'Date', render: (p: PaymentResponse) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(p.created_at)}</span> },
    { key: 'actions', header: '', headerClassName: 'w-12', render: (p: PaymentResponse) => <Button variant="ghost" size="icon" asChild title="View details" aria-label={`View payment ${p.merchant_order_id}`}><Link to={`/dashboard/payments/${encodeURIComponent(p.transaction_id)}`}><Eye className="h-4 w-4" aria-hidden="true" /></Link></Button> },
  ];

  const totalPages = listTotalPages(data?.meta);
  const errorCopy = isError ? paymentListErrorCopy(error) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="View and manage payments for your merchant."
        actions={canCreate && merchant?.status === 'ACTIVE' ? <Button asChild><Link to="/dashboard/payments/new"><Plus className="h-4 w-4" aria-hidden="true" /> Create payment</Link></Button> : <Button disabled title={!canCreate ? 'OWNER or ADMIN role required' : 'Merchant is not active'}><Plus className="h-4 w-4" aria-hidden="true" /> Create payment</Button>}
      />

      <section aria-label="Date range filter">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold leading-tight text-foreground">Filter Periode</h2>
                  <p className="truncate text-xs text-muted-foreground sm:whitespace-normal">Pilih periode untuk memfilter daftar transaksi</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1" role="group" aria-label="Date range presets">
                {OVERVIEW_PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    size="sm"
                    variant={pendingPreset === preset.key ? 'primary' : 'ghost'}
                    onClick={() => selectPreset(preset.key)}
                    aria-pressed={pendingPreset === preset.key}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5 sm:w-44">
                    <Label htmlFor="payments-start-date">Start date</Label>
                    <Input
                      id="payments-start-date"
                      type="date"
                      value={pendingStart}
                      hasError={rangeError !== null}
                      onChange={(event) => handleCustomDateChange('start', event.target.value)}
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5 sm:w-44">
                    <Label htmlFor="payments-end-date">End date</Label>
                    <Input
                      id="payments-end-date"
                      type="date"
                      value={pendingEnd}
                      hasError={rangeError !== null}
                      onChange={(event) => handleCustomDateChange('end', event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="flex-1 md:flex-none" onClick={applyRange}>Apply</Button>
                  <Button type="button" size="sm" variant="outline" className="flex-1 md:flex-none" onClick={resetRange}>Reset</Button>
                </div>
              </div>
              {rangeError && <p role="alert" className="text-xs font-medium text-danger">{rangeError}</p>}
              <div className="border-t border-border pt-2.5">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {appliedDate && appliedPresetLabel
                    ? <>Showing {formatDate(`${appliedDate.start}T00:00:00Z`)} – {formatDate(`${appliedDate.end}T00:00:00Z`)} · {appliedPresetLabel}</>
                    : 'Showing all payments'}
                  {pendingDirty && <span className="font-medium text-warning"> · Unsaved changes</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input aria-label="Search payments" placeholder="Search order ID or provider ID…" maxLength={200} className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="payment-status" className="sr-only">Filter by payment status</label>
              <select id="payment-status" className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="CREATED">Created</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>

        <CardContent className="border-t p-0">
          {isLoading ? <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div> : isError && errorCopy ? <ErrorState title={errorCopy.title} description={errorCopy.description} onRetry={() => void refetch()} /> : data && data.data.length > 0 ? (
            <>
              <DataTable columns={columns} data={data.data} getRowKey={(payment) => payment.transaction_id} className="border-0 rounded-none" />
              {totalPages > 1 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
            </>
          ) : <EmptyState title="No payments found" description="Payments matching these filters will appear here." icon={<CreditCard className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}
        </CardContent>
      </Card>
    </div>
  );
}
