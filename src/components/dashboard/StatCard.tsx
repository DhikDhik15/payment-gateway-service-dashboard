import { Card, CardContent, CardHeader, CardTitle, SkeletonCard } from '@/components/ui';

interface StatCardProps {
  label: string;
  value?: string | number;
  subValue?: string;
  isLoading?: boolean;
  icon: React.ElementType;
  iconClassName?: string;
}

/**
 * Shared dashboard summary card. Same card component, styling, typography,
 * and spacing everywhere it is used.
 */
export function StatCard({
  label,
  value,
  subValue,
  isLoading,
  icon: Icon,
  iconClassName = 'h-4 w-4 text-muted-foreground',
}: StatCardProps) {
  if (isLoading) return <SkeletonCard />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={iconClassName} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value ?? '—'}</div>
        {subValue && <p className="mt-1 text-xs text-muted-foreground">{subValue}</p>}
      </CardContent>
    </Card>
  );
}
