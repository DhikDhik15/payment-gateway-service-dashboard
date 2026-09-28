import { useState } from 'react';
import { SearchCheck, Eye } from 'lucide-react';
import { PageHeader, Card, CardContent, DataTable, ReconciliationStatusBadge, Button, SkeletonRow, EmptyState, ErrorState } from '@/components/ui';
import { useReconciliationMismatches } from '@/hooks/useReconciliation';
import { errorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { listTotalPages, type ReconciliationResult } from '@/types';
import { Link } from 'react-router-dom';

export function ReconciliationPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useReconciliationMismatches({ page, limit: 10 });
  const columns = [
    { key: 'id', header: 'ID', render: (item: ReconciliationResult) => <span className="font-mono text-xs text-muted-foreground">{item.id.slice(0, 8)}…</span> },
    { key: 'type', header: 'Result type', render: (item: ReconciliationResult) => <span className="text-sm font-medium">{item.result_type.replace(/_/g, ' ')}</span> },
    { key: 'expected', header: 'Expected', render: (item: ReconciliationResult) => item.expected_amount !== undefined ? formatCurrency(item.expected_amount, item.expected_currency ?? 'IDR') : '—' },
    { key: 'actual', header: 'Actual', render: (item: ReconciliationResult) => item.actual_amount !== undefined ? formatCurrency(item.actual_amount, item.actual_currency ?? 'IDR') : '—' },
    { key: 'status', header: 'Status', render: (item: ReconciliationResult) => <ReconciliationStatusBadge status={item.status} /> },
    { key: 'date', header: 'Detected', render: (item: ReconciliationResult) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span> },
    { key: 'actions', header: '', headerClassName: 'w-12', render: (item: ReconciliationResult) => <Button variant="ghost" size="icon" asChild title="View detail" aria-label={`View reconciliation ${item.id}`}><Link to={`/dashboard/reconciliation/${encodeURIComponent(item.id)}`}><Eye className="h-4 w-4" aria-hidden="true" /></Link></Button> },
  ];
  const totalPages = listTotalPages(data?.meta);
  return <div className="space-y-6"><PageHeader title="Reconciliation" description="Review merchant-scoped reconciliation mismatches." /><Card><CardContent className="p-0">{isLoading ? <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /></div> : isError ? <ErrorState title="Unable to load reconciliation" description={errorMessage(error, 'Reconciliation results could not be loaded.')} onRetry={() => void refetch()} /> : data && data.data.length > 0 ? <><DataTable columns={columns} data={data.data} getRowKey={(item) => item.id} className="border-0 rounded-none" />{totalPages > 1 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}</> : <EmptyState title="No mismatches found" description="No merchant-scoped discrepancies were returned by the backend." icon={<SearchCheck className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}</CardContent></Card></div>;
}
