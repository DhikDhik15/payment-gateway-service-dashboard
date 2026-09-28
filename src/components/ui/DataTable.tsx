import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─── Column definition ────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Render function for the cell */
  render: (row: T) => ReactNode;
  /** Optional class for the header cell */
  headerClassName?: string;
  /** Optional class for the data cell */
  cellClassName?: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  className?: string;
  emptyMessage?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  className,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  return (
    // Controlled overflow so the table scrolls on small screens
    <div className={cn('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left font-medium text-muted-foreground',
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-foreground', col.cellClassName)}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
