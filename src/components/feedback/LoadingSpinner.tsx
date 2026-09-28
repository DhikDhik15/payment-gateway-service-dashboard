import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
};

export function LoadingSpinner({
  label = 'Loading…',
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex items-center justify-center gap-2', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-full border-border border-t-primary animate-spin',
          sizeClasses[size],
        )}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
