import type { DashboardRevenueBucket } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

interface RevenueTrendChartProps {
  data: DashboardRevenueBucket[];
  currency: string;
}

const WIDTH = 640;
const HEIGHT = 200;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 56 };

function compactCurrency(value: number, currency: string): string {
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(value);
  }
  return new Intl.NumberFormat('id-ID', { notation: 'compact', style: 'currency', currency }).format(value);
}

/**
 * Gross-revenue time series rendered as SVG bars. Buckets come straight from
 * the backend aggregation (zero-filled); nothing is synthesized here.
 */
export function RevenueTrendChart({ data, currency }: RevenueTrendChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No revenue data in this period.</p>;
  }
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = data.reduce((peak, bucket) => Math.max(peak, bucket.revenue), 0);
  const slot = plotW / data.length;
  const barW = Math.max(slot * 0.62, 2);
  const scale = max > 0 ? plotH / max : 0;
  const ticks = max > 0 ? [0, max / 3, (2 * max) / 3, max] : [0];
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Revenue trend across ${data.length} periods, total ${formatCurrency(data.reduce((sum, b) => sum + b.revenue, 0), currency)}`}
    >
      {ticks.map((tick) => {
        const y = MARGIN.top + plotH - tick * scale;
        return (
          <g key={tick}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
            <text x={MARGIN.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {compactCurrency(Math.round(tick), currency)}
            </text>
          </g>
        );
      })}
      {data.map((bucket, index) => {
        const height = bucket.revenue * scale;
        const x = MARGIN.left + index * slot + (slot - barW) / 2;
        const y = MARGIN.top + plotH - height;
        const label = formatDate(`${bucket.date}T00:00:00Z`);
        return (
          <g key={bucket.date}>
            {max > 0 && height > 0 && (
              <rect x={x} y={y} width={barW} height={height} rx={2} className="fill-primary">
                <title>{`${label}: ${formatCurrency(bucket.revenue, currency)}`}</title>
              </rect>
            )}
            {index % labelEvery === 0 || index === data.length - 1 ? (
              <text x={MARGIN.left + index * slot + slot / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
