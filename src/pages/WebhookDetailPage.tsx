import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Clock, ExternalLink, CreditCard, Info } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  WebhookStatusBadge,
  SkeletonCard,
  ErrorState,
  Badge,
} from '@/components/ui';
import { useWebhookDeliveryDetail, useRetryWebhookDelivery } from '@/hooks/useWebhooks';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage, isMerchantInactiveError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

export function WebhookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const { data, isLoading, isError, error, refetch } = useWebhookDeliveryDetail(id);
  const retryMutation = useRetryWebhookDelivery();
  const canRetry = (user?.role === 'OWNER' || user?.role === 'ADMIN') && merchant?.status === 'ACTIVE' && !!data && ['FAILED', 'DEAD', 'PENDING'].includes(data.status);

  if (isLoading) return <SkeletonCard />;
  if (isError || !data) return <ErrorState title="Could not load webhook delivery" description={errorMessage(error, 'The delivery record could not be loaded.')} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Button variant="ghost" size="icon" asChild aria-label="Back to webhooks"><Link to="/dashboard/webhooks"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></Link></Button><PageHeader title="Webhook delivery" description={data.id} /></div>
      {retryMutation.isError && <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{isMerchantInactiveError(retryMutation.error) ? 'The merchant is not active, so the delivery was not retried.' : errorMessage(retryMutation.error)}</div>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Delivery information</CardTitle><WebhookStatusBadge status={data.status} /></CardHeader><CardContent><dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2"><div><dt className="text-sm font-medium text-muted-foreground">Event ID</dt><dd className="mt-1 break-all font-mono text-sm">{data.event_id}</dd></div><div><dt className="text-sm font-medium text-muted-foreground">Event type</dt><dd className="mt-1 font-semibold">{data.event_type}</dd></div><div className="sm:col-span-2"><dt className="text-sm font-medium text-muted-foreground">Endpoint URL</dt><dd className="mt-1 break-all font-mono text-sm">{data.endpoint_url}</dd></div><div><dt className="text-sm font-medium text-muted-foreground">Attempts</dt><dd className="mt-1 text-sm">{data.attempt_count}</dd></div><div><dt className="text-sm font-medium text-muted-foreground">Last HTTP status</dt><dd className="mt-1">{data.last_http_status ? <Badge variant={data.last_http_status >= 200 && data.last_http_status < 300 ? 'success' : 'danger'}>{data.last_http_status}</Badge> : <span className="text-muted-foreground">Not available</span>}</dd></div><div><dt className="text-sm font-medium text-muted-foreground">Created at</dt><dd className="mt-1 text-sm">{formatDateTime(data.created_at)}</dd></div><div><dt className="text-sm font-medium text-muted-foreground">Updated at</dt><dd className="mt-1 text-sm">{formatDateTime(data.updated_at)}</dd></div>{data.delivered_at && <div><dt className="text-sm font-medium text-muted-foreground">Delivered at</dt><dd className="mt-1 text-sm">{formatDateTime(data.delivered_at)}</dd></div>}{data.next_attempt_at && data.status === 'PENDING' && <div><dt className="text-sm font-medium text-muted-foreground">Next attempt</dt><dd className="mt-1 flex items-center gap-2 text-sm"><Clock className="h-3 w-3" aria-hidden="true" />{formatDateTime(data.next_attempt_at)}</dd></div>}</dl></CardContent></Card>
          <Card className="border-info/20 bg-info/5"><CardContent className="flex items-start gap-2 p-4 text-sm text-info"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p className="text-xs">For safety, the dashboard does not display raw provider response bodies or signing material. Use the delivery status, HTTP status, and your server logs for diagnostics.</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Related transaction</CardTitle></CardHeader><CardContent><div className="flex items-center justify-between gap-3 rounded-lg border p-4"><div className="flex min-w-0 items-center gap-3"><CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-medium">Payment transaction</p><p className="truncate font-mono text-xs text-muted-foreground">{data.transaction_id}</p></div></div><Button variant="ghost" size="sm" asChild><Link to={`/dashboard/payments/${encodeURIComponent(data.transaction_id)}`}><ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Open payment</span></Link></Button></div></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader><CardContent><Button className="w-full" onClick={() => retryMutation.mutate(data.id)} disabled={!canRetry || retryMutation.isPending} title={!canRetry ? 'OWNER or ADMIN role, active merchant, and retryable status required' : undefined}><RefreshCw className={`mr-2 h-4 w-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} aria-hidden="true" /> Retry delivery</Button></CardContent></Card>
      </div>
    </div>
  );
}
