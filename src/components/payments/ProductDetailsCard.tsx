import { Card, CardContent, CardHeader, CardTitle, DataTable } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { DashboardPaymentOrderItem } from '@/types';

/**
 * Product purchase breakdown for a dashboard payment.
 *
 * Renders the immutable order-item snapshots (name, unit price, quantity,
 * stored subtotal) plus the product subtotal (sum of stored line subtotals,
 * integer arithmetic only). The authoritative payment total is shown only
 * when it differs from the product subtotal, so the two figures are never
 * confused. Renders nothing when there are no items.
 */
export function ProductDetailsCard({
  items,
  currency,
  paymentTotal,
}: {
  items: DashboardPaymentOrderItem[];
  currency: string;
  /** Authoritative payment amount, integer minor units. */
  paymentTotal: number;
}) {
  if (items.length === 0) return null;
  const productSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalsDiffer = productSubtotal !== paymentTotal;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DataTable
          columns={[
            {
              key: 'product',
              header: 'Product',
              render: (row) => (
                <span className="block max-w-56 break-words font-medium sm:max-w-none">
                  {row.product_name}
                </span>
              ),
            },
            {
              key: 'unit_price',
              header: 'Unit Price',
              headerClassName: 'text-right',
              cellClassName: 'text-right tabular-nums whitespace-nowrap',
              render: (row) => formatCurrency(row.unit_price, currency),
            },
            {
              key: 'quantity',
              header: 'Quantity',
              headerClassName: 'text-right',
              cellClassName: 'text-right tabular-nums',
              render: (row) => row.quantity.toLocaleString('en-US'),
            },
            {
              key: 'subtotal',
              header: 'Subtotal',
              headerClassName: 'text-right',
              cellClassName: 'text-right tabular-nums whitespace-nowrap font-medium',
              render: (row) => formatCurrency(row.subtotal, currency),
            },
          ]}
          data={items}
          getRowKey={(row) =>
            `${row.product_name}|${row.unit_price}|${row.quantity}|${row.subtotal}`
          }
        />
        <div className="space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Product subtotal</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(productSubtotal, currency)}
            </span>
          </div>
          {totalsDiffer && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Payment total</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(paymentTotal, currency)}
              </span>
            </div>
          )}
          {totalsDiffer && (
            <p className="text-xs text-muted-foreground">
              The payment total is authoritative and may include adjustments
              outside the product breakdown.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
