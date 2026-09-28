import { LayoutDashboard, TrendingUp, CreditCard, RefreshCcw, AlertTriangle } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  SkeletonCard,
  DataTable,
  PaymentStatusBadge,
  Badge,
  ErrorState,
} from '@/components/ui';
import { useOverview } from '@/hooks/useOverview';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { PaymentResponse } from '@/types';

interface MetricCardProps { label: string; value?: string | number; subValue?: string; isLoading?: boolean; icon: React.ElementType; }
function MetricCard({ label, value, subValue, isLoading, icon: Icon }: MetricCardProps) {
  if (isLoading) return <SkeletonCard />;
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></CardHeader><CardContent><div className="text-2xl font-bold">{value ?? '—'}</div>{subValue && <p className="mt-1 text-xs text-muted-foreground">{subValue}</p>}</CardContent></Card>;
}

const columns = [
  { key: 'order_id', header: 'Order ID', render: (payment: PaymentResponse) => <span className="font-mono text-xs">{payment.merchant_order_id}</span> },
  { key: 'amount', header: 'Amount', render: (payment: PaymentResponse) => formatCurrency(payment.amount, payment.currency) },
  { key: 'status', header: 'Status', render: (payment: PaymentResponse) => <PaymentStatusBadge status={payment.status} /> },
  { key: 'created_at', header: 'Date', render: (payment: PaymentResponse) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(payment.created_at)}</span> },
];

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useOverview();
  const { data: merchant } = useSettings();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const successRate = data && data.payments.total > 0 ? Math.round((data.payments.paid / data.payments.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description={`${greeting}. Here is what is happening with your merchant.`} actions={merchant ? <Badge variant={merchant.status === 'ACTIVE' ? 'success' : 'warning'}>{merchant.name} · {merchant.status}</Badge> : undefined} />
      {merchant && merchant.status !== 'ACTIVE' && <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Some operations are unavailable because this merchant is {merchant.status.toLowerCase()}.</div>}

      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Paid revenue" value={data ? formatCurrency(data.revenue.amount, data.revenue.currency) : undefined} isLoading={isLoading} icon={TrendingUp} subValue="Paid payments in the selected period" />
          <MetricCard label="Successful payments" value={data?.payments.paid} isLoading={isLoading} icon={CreditCard} subValue={`${data?.payments.total ?? 0} total payment attempts`} />
          <MetricCard label="Success rate" value={isLoading ? undefined : `${successRate}%`} isLoading={isLoading} icon={RefreshCcw} subValue="Paid payments divided by total payments" />
        </div>
      </section>

      <section aria-label="Recent payments">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Recent payments</h2></div>
        <Card><CardContent className="p-0">
          {isLoading ? <div className="space-y-4 p-8"><div className="h-4 w-full animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /></div> : isError ? <ErrorState title="Unable to load overview" description={errorMessage(error, 'The dashboard overview is temporarily unavailable.')} onRetry={() => void refetch()} /> : data && data.recent_payments.length > 0 ? <DataTable columns={columns} data={data.recent_payments} getRowKey={(payment) => payment.transaction_id} className="border-0 rounded-none" /> : <EmptyState title="No recent payments" description="When payments are created, they will appear here." icon={<LayoutDashboard className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}
        </CardContent></Card>
      </section>
    </div>
  );
}
