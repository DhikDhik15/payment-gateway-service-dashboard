import { useState } from 'react';
import { Webhook, Eye, RefreshCw, Info } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  DataTable,
  WebhookStatusBadge,
  Button,
  SkeletonRow,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { useWebhookDeliveries, useRetryWebhookDelivery } from '@/hooks/useWebhooks';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage, isMerchantInactiveError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import { listTotalPages, type MerchantWebhookDeliveryResponse } from '@/types';
import { Link } from 'react-router-dom';

export function WebhooksPage() {
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const { data, isLoading, isError, error, refetch } = useWebhookDeliveries({ page, limit: 10 });
  const retryMutation = useRetryWebhookDelivery();
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const canRetry = canManage && merchant?.status === 'ACTIVE';

  const columns = [
    { key: 'event_id', header: 'Event ID', render: (delivery: MerchantWebhookDeliveryResponse) => <span className="font-mono text-xs text-muted-foreground">{delivery.event_id}</span> },
    { key: 'event_type', header: 'Event', render: (delivery: MerchantWebhookDeliveryResponse) => <span className="font-medium">{delivery.event_type}</span> },
    { key: 'status', header: 'Status', render: (delivery: MerchantWebhookDeliveryResponse) => <WebhookStatusBadge status={delivery.status} /> },
    { key: 'attempts', header: 'Attempts', render: (delivery: MerchantWebhookDeliveryResponse) => delivery.attempt_count },
    { key: 'created_at', header: 'Date', render: (delivery: MerchantWebhookDeliveryResponse) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(delivery.created_at)}</span> },
    { key: 'actions', header: '', headerClassName: 'w-24', render: (delivery: MerchantWebhookDeliveryResponse) => <div className="flex items-center gap-2">{['FAILED', 'DEAD', 'PENDING'].includes(delivery.status) && <Button variant="ghost" size="icon" aria-label={`Retry delivery ${delivery.id}`} title={canRetry ? 'Retry now' : 'OWNER or ADMIN role and active merchant required'} disabled={!canRetry || retryMutation.isPending} onClick={() => retryMutation.mutate(delivery.id)}><RefreshCw className={`h-4 w-4 ${retryMutation.isPending && retryMutation.variables === delivery.id ? 'animate-spin' : ''}`} aria-hidden="true" /></Button>}<Button variant="ghost" size="icon" asChild title="View detail" aria-label={`View delivery ${delivery.id}`}><Link to={`/dashboard/webhooks/${encodeURIComponent(delivery.id)}`}><Eye className="h-4 w-4" aria-hidden="true" /></Link></Button></div> },
  ];

  const totalPages = listTotalPages(data?.meta);
  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description="Monitor safe outbound webhook delivery metadata for your merchant." actions={<Button variant="outline" asChild><Link to="/dashboard/webhook-config">Configure endpoint</Link></Button>} />
      {!canManage && <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-sm text-info" role="status"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Your VIEWER role can inspect deliveries but cannot retry them.</div>}
      {retryMutation.isError && <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{isMerchantInactiveError(retryMutation.error) ? 'The merchant is not active, so the delivery was not retried.' : errorMessage(retryMutation.error)}</div>}
      <Card><CardContent className="p-0">
        {isLoading ? <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div> : isError ? <ErrorState title="Unable to load webhook deliveries" description={errorMessage(error, 'Webhook delivery history could not be loaded.')} onRetry={() => void refetch()} /> : data && data.data.length > 0 ? <><DataTable columns={columns} data={data.data} getRowKey={(delivery) => delivery.id} className="border-0 rounded-none" />{totalPages > 1 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}</> : <EmptyState title="No webhook deliveries" description="Configure an endpoint to start receiving supported events." icon={<Webhook className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}
      </CardContent></Card>
    </div>
  );
}
