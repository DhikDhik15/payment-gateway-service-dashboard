import { AlertTriangle, CircleCheck, Loader2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage, isMerchantInactiveError } from '@/lib/api';
import { ApiClientError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export function MerchantStatusBanner() {
  const { data, isLoading, isError, error } = useSettings();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground md:px-6" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Loading merchant status…
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiClientError && error.status === 401) return null;
    return (
      <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/5 px-4 py-2 text-xs text-warning md:px-6" role="alert">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Merchant status could not be refreshed. {isMerchantInactiveError(error) ? 'Contact support if your account is inactive.' : errorMessage(error)}</span>
      </div>
    );
  }

  if (!data || data.status === 'ACTIVE') return null;

  const suspended = data.status === 'SUSPENDED';
  return (
    <div
      className={cn(
        'flex items-start gap-2 border-b px-4 py-2 text-xs md:px-6',
        suspended ? 'border-danger/30 bg-danger/5 text-danger' : 'border-warning/30 bg-warning/5 text-warning',
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Merchant {suspended ? 'suspended' : 'inactive'}</p>
        <p className="mt-0.5">
          {suspended
            ? 'Payments and account changes are currently unavailable. Contact PayGate support for help.'
            : 'Payments and account changes are currently unavailable until this merchant is activated.'}
        </p>
      </div>
    </div>
  );
}

export function ActiveMerchantIndicator({ status }: { status?: string }) {
  const active = status === 'ACTIVE';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', active ? 'text-success' : 'text-warning')} role="status">
      {active ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
      {status ?? 'UNKNOWN'}
    </span>
  );
}
