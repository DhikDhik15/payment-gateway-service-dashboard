import { useState } from 'react';
import { CreditCard, Search, Filter, Eye, Plus } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  DataTable,
  PaymentStatusBadge,
  Input,
  Button,
  SkeletonRow,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { usePayments } from '@/hooks/usePayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDateTime } from '@/lib/utils';
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
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const canCreate = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const { data, isLoading, isError, error, refetch } = usePayments({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

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
