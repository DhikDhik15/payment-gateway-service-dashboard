import { CreditCard, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  ErrorState,
  SkeletonCard,
} from '@/components/ui';
import { DateRangeFilterPanel } from './DateRangeFilterPanel';
import { RevenueTrendChart } from './RevenueTrendChart';
import { StatCard } from './StatCard';
import { TopProductsChart } from './TopProductsChart';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import { errorMessage } from '@/lib/api';
import { formatCurrency, formatDate, formatInteger } from '@/lib/utils';
import type { DashboardProductSales } from '@/types';

const productColumns = (currency: string) => [
  {
    key: 'product_name',
    header: 'Product',
    render: (row: DashboardProductSales) => <span className="font-medium">{row.product_name}</span>,
  },
  {
    key: 'units_sold',
    header: 'Units sold',
    render: (row: DashboardProductSales) => formatInteger(row.units_sold),
  },
  {
    key: 'revenue',
    header: 'Revenue',
    render: (row: DashboardProductSales) => (
      <span className="whitespace-nowrap">{formatCurrency(row.revenue, currency)}</span>
    ),
  },
];

/**
 * Analytics tab: revenue and product-sales analysis for the tab's own applied
 * date range. All figures come from GET /api/v1/dashboard/analytics — real
 * merchant-scoped backend aggregates, never mock data.
 */
export function AnalyticsPanel() {
  const filter = useDateRangeFilter();
  const { data, isLoading, isError, error, refetch } = useAnalytics(
    filter.params.from,
    filter.params.to,
  );

  return (
    <div className="space-y-6">
      <DateRangeFilterPanel
        idPrefix="analytics"
        title="Filter Periode"
        description="Pilih periode untuk melihat tren pendapatan dan penjualan produk"
        pendingPreset={filter.pendingPreset}
        pendingStart={filter.pendingStart}
        pendingEnd={filter.pendingEnd}
        rangeError={filter.rangeError}
        summary={
          <>
            Showing {formatDate(`${filter.applied.start}T00:00:00Z`)} –{' '}
            {formatDate(`${filter.applied.end}T00:00:00Z`)} · {filter.appliedPresetLabel}
            {filter.pendingDirty && <span className="font-medium text-warning"> · Unsaved changes</span>}
          </>
        }
        onSelectPreset={filter.selectPreset}
        onDateChange={filter.handleCustomDateChange}
        onApply={filter.applyRange}
        onReset={filter.resetRange}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load analytics"
          description={errorMessage(error, 'Revenue and product analytics are temporarily unavailable.')}
          onRetry={() => void refetch()}
        />
      ) : data ? (
        <>
          <section aria-label="Analytics summary">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Revenue"
                value={formatCurrency(data.summary.total_revenue, data.currency)}
                isLoading={false}
                icon={TrendingUp}
                subValue={`Gross paid revenue · ${filter.appliedPresetLabel}`}
              />
              <StatCard
                label="Successful Payments"
                value={formatInteger(data.summary.successful_payments)}
                isLoading={false}
                icon={CreditCard}
                subValue="Paid transactions in the selected period"
              />
              <StatCard
                label="Units Sold"
                value={formatInteger(data.summary.units_sold)}
                isLoading={false}
                icon={ShoppingBag}
                subValue="Items from successfully paid orders"
              />
              <StatCard
                label="Average Order Value"
                value={
                  data.summary.average_order_value === null
                    ? undefined
                    : formatCurrency(data.summary.average_order_value, data.currency)
                }
                isLoading={false}
                icon={Receipt}
                subValue="Order value per unique paid order"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
            <section aria-label="Revenue trend" className="lg:col-span-3">
              <Card>
                <CardHeader className="px-4 pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold text-foreground">Revenue Trend</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Gross paid revenue per {data.interval === 'week' ? 'week' : 'day'} ·{' '}
                    {filter.appliedPresetLabel}
                  </p>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <RevenueTrendChart data={data.revenue_trend} currency={data.currency} />
                </CardContent>
              </Card>
            </section>

            <section aria-label="Top selling products" className="lg:col-span-2">
              <Card>
                <CardHeader className="px-4 pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold text-foreground">Top Selling Products</CardTitle>
                  <p className="text-xs text-muted-foreground">Top 5 products by units sold</p>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <TopProductsChart data={data.top_products} currency={data.currency} />
                </CardContent>
              </Card>
            </section>
          </div>

          <section aria-label="Revenue by product">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Revenue by Product</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                {data.revenue_by_product.length > 0 ? (
                  <DataTable
                    columns={productColumns(data.currency)}
                    data={data.revenue_by_product}
                    getRowKey={(row) => row.product_id ?? `name:${row.product_name}`}
                    className="border-0 rounded-none"
                    emptyMessage="No product sales in this period."
                  />
                ) : (
                  <EmptyState
                    title="No product sales"
                    description="Products sold in the selected period will appear here."
                  />
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
