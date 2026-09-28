import { useState } from 'react';
import { Undo2, Filter, Eye } from 'lucide-react';
import { PageHeader, Card, CardContent, DataTable, RefundStatusBadge, Button, SkeletonRow, EmptyState, ErrorState } from '@/components/ui';
import { useRefunds } from '@/hooks/useRefunds';
import { errorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { listTotalPages, type RefundResponse } from '@/types';
import { Link } from 'react-router-dom';

export function RefundsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading, isError, error, refetch } = useRefunds({ page, limit: 10, status: status || undefined });
  const columns = [
    { key: 'refund_id', header: 'Refund ID', render: (refund: RefundResponse) => <span className="font-mono text-xs text-muted-foreground">{refund.refund_id.slice(0, 8)}…</span> },
    { key: 'transaction_id', header: 'Payment ID', render: (refund: RefundResponse) => <Link to={`/dashboard/payments/${encodeURIComponent(refund.transaction_id)}`} className="font-mono text-xs text-primary hover:underline">{refund.transaction_id.slice(0, 8)}…</Link> },
    { key: 'amount', header: 'Amount', render: (refund: RefundResponse) => formatCurrency(refund.amount, refund.currency) },
    { key: 'status', header: 'Status', render: (refund: RefundResponse) => <RefundStatusBadge status={refund.status} /> },
    { key: 'requested_at', header: 'Requested', render: (refund: RefundResponse) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(refund.requested_at)}</span> },
    { key: 'actions', header: '', headerClassName: 'w-12', render: (refund: RefundResponse) => <Button variant="ghost" size="icon" asChild title="View details" aria-label={`View refund ${refund.refund_id}`}><Link to={`/dashboard/refunds/${encodeURIComponent(refund.refund_id)}`}><Eye className="h-4 w-4" aria-hidden="true" /></Link></Button> },
  ];
  const totalPages = listTotalPages(data?.meta);
  return <div className="space-y-6"><PageHeader title="Refunds" description="Monitor refund requests for your merchant." /><Card><CardContent className="flex justify-end border-b p-4"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><label htmlFor="refund-status" className="sr-only">Filter by refund status</label><select id="refund-status" className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="SUCCEEDED">Succeeded</option><option value="PROCESSING">Processing</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option></select></div></CardContent><CardContent className="p-0">{isLoading ? <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div> : isError ? <ErrorState title="Unable to load refunds" description={errorMessage(error, 'Refund history could not be loaded.')} onRetry={() => void refetch()} /> : data && data.data.length > 0 ? <><DataTable columns={columns} data={data.data} getRowKey={(refund) => refund.refund_id} className="border-0 rounded-none" />{totalPages > 1 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}</> : <EmptyState title="No refunds found" description="When refunds are created, they will appear here." icon={<Undo2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}</CardContent></Card></div>;
}
