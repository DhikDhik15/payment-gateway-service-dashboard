import { useState } from 'react';
import { LayoutDashboard, TrendingUp, CreditCard, RefreshCcw, AlertTriangle, XCircle } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  EmptyState,
  DataTable,
  PaymentStatusBadge,
  Badge,
  Button,
  ErrorState,
} from '@/components/ui';
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel';
import { DateRangeFilterPanel } from '@/components/dashboard/DateRangeFilterPanel';
import { StatCard as MetricCard } from '@/components/dashboard/StatCard';
import { useOverview } from '@/hooks/useOverview';
import { overviewUnsuccessfulCount } from '@/hooks/overviewQuery';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { PaymentResponse } from '@/types';

type DashboardTab = 'overview' | 'analytics';

const TABS: { key: DashboardTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'analytics', label: 'Analytics' },
];

const columns = [
  { key: 'order_id', header: 'Order ID', render: (payment: PaymentResponse) => <span className="font-mono text-xs">{payment.merchant_order_id}</span> },
  { key: 'amount', header: 'Amount', render: (payment: PaymentResponse) => formatCurrency(payment.amount, payment.currency) },
  { key: 'status', header: 'Status', render: (payment: PaymentResponse) => <PaymentStatusBadge status={payment.status} /> },
  { key: 'created_at', header: 'Date', render: (payment: PaymentResponse) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(payment.created_at)}</span> },
];

export function DashboardPage() {
  const [tab, setTab] = useState<DashboardTab>('overview');
  // Canonical Overview date-range state. Untouched by the Analytics tab, which
  // owns an independent instance of the same filter. Defaults to Last 7 Days.
  const filter = useDateRangeFilter();

  // `to` is the exclusive end (midnight after the inclusive end day).
  // from/to are part of the query key, so each range caches separately and a
  // slow response for an old range can never overwrite the current one.
  const { data, isLoading, isError, error, refetch } = useOverview(
    filter.params.from,
    filter.params.to,
  );
  const { data: merchant } = useSettings();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const successRate = data && data.payments.total > 0 ? Math.round((data.payments.paid / data.payments.total) * 100) : 0;

  const handleTabKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    setTab((current) => {
      const index = TABS.findIndex((entry) => entry.key === current);
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      return TABS[(index + delta + TABS.length) % TABS.length].key;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tab === 'analytics' ? 'Analytics' : 'Overview'}
        description={
          tab === 'analytics'
            ? 'Revenue trends and product sales for your merchant.'
            : `${greeting}. Here is what is happening with your merchant.`
        }
        actions={merchant ? <Badge variant={merchant.status === 'ACTIVE' ? 'success' : 'warning'}>{merchant.name} · {merchant.status}</Badge> : undefined}
      />
      {merchant && merchant.status !== 'ACTIVE' && <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Some operations are unavailable because this merchant is {merchant.status.toLowerCase()}.</div>}

      <div role="tablist" aria-label="Dashboard views" onKeyDown={handleTabKeyDown} className="flex w-fit gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {TABS.map((entry) => (
          <Button
            key={entry.key}
            type="button"
            size="sm"
            role="tab"
            id={`dashboard-tab-${entry.key}`}
            aria-selected={tab === entry.key}
            aria-controls={`dashboard-panel-${entry.key}`}
            tabIndex={tab === entry.key ? 0 : -1}
            variant={tab === entry.key ? 'primary' : 'ghost'}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="dashboard-panel-overview"
        aria-labelledby="dashboard-tab-overview"
        hidden={tab !== 'overview'}
      >
      <div className="space-y-6">
      <DateRangeFilterPanel
        idPrefix="overview"
        title="Filter Periode"
        description="Pilih periode untuk melihat statistik dan transaksi"
        pendingPreset={filter.pendingPreset}
        pendingStart={filter.pendingStart}
        pendingEnd={filter.pendingEnd}
        rangeError={filter.rangeError}
        summary={
          <>
            Showing {formatDate(`${filter.applied.start}T00:00:00Z`)} – {formatDate(`${filter.applied.end}T00:00:00Z`)} · {filter.appliedPresetLabel}
            {filter.pendingDirty && <span className="font-medium text-warning"> · Unsaved changes</span>}
          </>
        }
        onSelectPreset={filter.selectPreset}
        onDateChange={filter.handleCustomDateChange}
        onApply={filter.applyRange}
        onReset={filter.resetRange}
      />

      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Paid revenue" value={data ? formatCurrency(data.revenue.amount, data.revenue.currency) : undefined} isLoading={isLoading} icon={TrendingUp} subValue="Paid payments in the selected period" />
          <MetricCard label="Successful payments" value={data?.payments.paid} isLoading={isLoading} icon={CreditCard} subValue={`${data?.payments.total ?? 0} total payment attempts`} />
          <MetricCard label="Success rate" value={isLoading ? undefined : `${successRate}%`} isLoading={isLoading} icon={RefreshCcw} subValue="Paid payments divided by total payments" />
          <MetricCard label="Unsuccessful Transactions" value={data ? overviewUnsuccessfulCount(data) : undefined} isLoading={isLoading} icon={XCircle} iconClassName="h-4 w-4 text-danger" subValue="Expired, canceled, failed, and other unsuccessful transactions." />
        </div>
      </section>

      <section aria-label="Recent payments">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Recent payments</h2></div>
        <Card><CardContent className="p-0">
          {isLoading ? <div className="space-y-4 p-8"><div className="h-4 w-full animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /></div> : isError ? <ErrorState title="Unable to load overview" description={errorMessage(error, 'The dashboard overview is temporarily unavailable.')} onRetry={() => void refetch()} /> : data && data.recent_payments.length > 0 ? <DataTable columns={columns} data={data.recent_payments} getRowKey={(payment) => payment.transaction_id} className="border-0 rounded-none" /> : <EmptyState title="No recent payments" description="No payments found for the selected period." icon={<LayoutDashboard className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}
        </CardContent></Card>
      </section>
      </div>
      </div>

      <div
        role="tabpanel"
        id="dashboard-panel-analytics"
        aria-labelledby="dashboard-tab-analytics"
        hidden={tab !== 'analytics'}
      >
        <AnalyticsPanel />
      </div>
    </div>
  );
}
