import type { DashboardProductSales } from '@/types';
import { formatCurrency, formatInteger } from '@/lib/utils';

interface TopProductsChartProps {
  data: DashboardProductSales[];
  currency: string;
}

/**
 * Top products ranked by units sold (backend order preserved), rendered as
 * accessible horizontal bars. Values are backend aggregates; widths are only
 * relative presentation scaling.
 */
export function TopProductsChart({ data, currency }: TopProductsChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No product sales in this period.</p>;
  }
  const maxUnits = Math.max(...data.map((row) => row.units_sold), 1);
  return (
    <ul className="space-y-3" aria-label="Top selling products by units sold">
      {data.map((row, index) => {
        const widthPct = row.units_sold > 0 ? Math.max((row.units_sold / maxUnits) * 100, 4) : 0;
        return (
          <li key={row.product_id ?? `name:${row.product_name}`}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-foreground">
                <span className="mr-1.5 text-muted-foreground" aria-hidden="true">{index + 1}.</span>
                {row.product_name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatInteger(row.units_sold)} units · {formatCurrency(row.revenue, currency)}
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${row.product_name}: ${formatInteger(row.units_sold)} units sold, revenue ${formatCurrency(row.revenue, currency)}`}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
