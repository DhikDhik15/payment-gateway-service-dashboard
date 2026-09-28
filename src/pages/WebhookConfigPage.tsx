import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RefreshCw, Trash2, AlertTriangle, Eye, EyeOff, Copy, Check, Info, Webhook } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Badge,
  SkeletonCard,
  ErrorState,
} from '@/components/ui';
import { useWebhookConfig, useUpsertWebhookConfig, useRotateWebhookSecret, useDisableWebhookConfig } from '@/hooks/useWebhooks';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage, fieldError, isMerchantInactiveError } from '@/lib/api';
import { ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';

const webhookSchema = z.object({
  url: z.string().trim().url('Enter a valid absolute URL').superRefine((value, context) => {
    try {
      const parsed = new URL(value);
      if (import.meta.env.MODE === 'production' && parsed.protocol !== 'https:') {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Production webhook URLs must use HTTPS.' });
      }
      if (parsed.username || parsed.password) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Webhook URLs cannot contain embedded credentials.' });
      }
    } catch {
      // The URL validator above supplies the user-facing format error.
    }
  }),
  description: z.string().trim().max(100, 'Maximum 100 characters').optional(),
});
type WebhookFormValues = z.infer<typeof webhookSchema>;

export function WebhookConfigPage() {
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const configQuery = useWebhookConfig();
  const upsertMutation = useUpsertWebhookConfig();
  const rotateMutation = useRotateWebhookSecret();
  const disableMutation = useDisableWebhookConfig();
  const [recentSecret, setRecentSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const form = useForm<WebhookFormValues>({ resolver: zodResolver(webhookSchema), defaultValues: { url: '', description: '' } });
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const merchantActive = merchant?.status === 'ACTIVE';
  const config = configQuery.data;
  const notConfigured = configQuery.isError && configQuery.error instanceof ApiClientError && configQuery.error.status === 404;

  useEffect(() => {
    if (config) form.reset({ url: config.url, description: config.description ?? '' });
  }, [config, form]);

  const clearSecret = () => { setRecentSecret(null); setShowSecret(false); setCopied(false); upsertMutation.reset(); rotateMutation.reset(); };
  const copySecret = async () => {
    if (!recentSecret) return;
    try { await navigator.clipboard.writeText(recentSecret); setCopied(true); window.setTimeout(() => setCopied(false), 2_000); } catch { setCopied(false); }
  };

  const save = (values: WebhookFormValues) => {
    upsertMutation.mutate({ url: values.url.trim(), description: values.description?.trim() || undefined }, { onSuccess: (result) => { setRecentSecret(result.secret); setShowSecret(true); } });
  };
  const rotate = () => {
    if (!window.confirm('Rotate the signing secret? Deliveries signed with the old secret may need to be updated immediately.')) return;
    rotateMutation.mutate(undefined, { onSuccess: (result) => { setRecentSecret(result.secret); setShowSecret(true); } });
  };
  const disable = () => {
    if (!window.confirm('Disable outbound webhooks? Existing delivery history will be kept.')) return;
    disableMutation.mutate();
  };

  if (configQuery.isLoading) return <SkeletonCard />;
  if (configQuery.isError && !notConfigured) return <ErrorState title="Unable to load webhook configuration" description={errorMessage(configQuery.error)} onRetry={() => void configQuery.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Webhook configuration" description="Configure where PayGate sends real-time event notifications." />
      {!canManage && <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-sm text-info" role="status"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Your VIEWER role can view configuration status but cannot change it.</div>}
      {merchant && !merchantActive && <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert">Webhook mutations are unavailable while the merchant is {merchant.status.toLowerCase()}.</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Endpoint settings</CardTitle><CardDescription>PayGate sends POST requests for supported payment and refund events. The backend validates destination safety.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(save)} className="space-y-4" noValidate>
                <div className="space-y-2"><Label htmlFor="webhook-url" required>Payload URL</Label><Input id="webhook-url" type="url" placeholder="https://your-api.example/webhooks" {...form.register('url')} error={form.formState.errors.url?.message ?? fieldError(upsertMutation.error, 'url')} /><p className="text-xs text-muted-foreground">Use an HTTPS endpoint. Private, loopback, reserved, and unsafe redirect destinations are rejected by the backend.</p></div>
                <div className="space-y-2"><Label htmlFor="webhook-description">Description (optional)</Label><Input id="webhook-description" placeholder="Production server" {...form.register('description')} error={form.formState.errors.description?.message ?? fieldError(upsertMutation.error, 'description')} /></div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><Badge variant={config?.status === 'ACTIVE' ? 'success' : config ? 'default' : 'outline'}>{config?.status ?? (notConfigured ? 'NOT CONFIGURED' : 'UNKNOWN')}</Badge><Button type="submit" isLoading={upsertMutation.isPending} disabled={!canManage || !merchantActive}>{config ? 'Update configuration' : 'Create configuration'}</Button></div>
                {upsertMutation.isError && <p className="text-sm text-danger" role="alert">{isMerchantInactiveError(upsertMutation.error) ? 'The merchant is not active, so the configuration was not changed.' : errorMessage(upsertMutation.error)}</p>}
              </form>
            </CardContent>
          </Card>

          {recentSecret && <Card className="border-warning bg-warning/5"><CardHeader className="pb-2"><div className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" aria-hidden="true" /><CardTitle className="text-sm">New signing secret</CardTitle></div><CardDescription>This secret is shown once. Copy it now and store it securely.</CardDescription></CardHeader><CardContent><div className="flex items-center gap-2 rounded-md border bg-background p-2"><code className="flex-1 break-all text-xs font-mono">{showSecret ? recentSecret : '••••••••••••••••••••••••••••••••'}</code><Button type="button" variant="ghost" size="icon" aria-label={showSecret ? 'Hide signing secret' : 'Show signing secret'} onClick={() => setShowSecret((value) => !value)}>{showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</Button><Button type="button" variant="ghost" size="icon" aria-label="Copy signing secret" onClick={() => void copySecret()}>{copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}</Button></div><Button className="mt-3" variant="outline" size="sm" onClick={clearSecret}>I have saved the secret</Button></CardContent></Card>}

          {config && <Card><CardHeader><CardTitle>Security controls</CardTitle><CardDescription>Signing secrets are never returned by the configuration read endpoint.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="text-sm font-medium">Rotate signing secret</p><p className="text-xs text-muted-foreground">New deliveries use the new secret immediately.</p></div><Button variant="outline" size="sm" onClick={rotate} disabled={!canManage || !merchantActive || rotateMutation.isPending}><RefreshCw className={`mr-2 h-3 w-3 ${rotateMutation.isPending ? 'animate-spin' : ''}`} aria-hidden="true" /> Rotate</Button></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4"><div><p className="text-sm font-medium text-danger">Disable outbound webhooks</p><p className="text-xs text-muted-foreground">Stops new deliveries; history remains available.</p></div><Button variant="danger" size="sm" onClick={disable} disabled={!canManage || !merchantActive || disableMutation.isPending || config.status === 'DISABLED'}><Trash2 className="mr-2 h-3 w-3" aria-hidden="true" /> Disable</Button></div>{(rotateMutation.isError || disableMutation.isError) && <p className="text-sm text-danger" role="alert">{errorMessage(rotateMutation.error ?? disableMutation.error)}</p>}</CardContent></Card>}
        </div>

        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Webhook className="h-4 w-4" aria-hidden="true" /> Event coverage</CardTitle></CardHeader><CardContent><ul className="space-y-2 text-xs text-muted-foreground"><li>Payment created and status changes</li><li>Refund lifecycle events</li><li>Signed delivery headers and bounded retries</li></ul><p className="mt-4 text-[11px] leading-relaxed">The backend controls event eligibility and delivery retries. Use the Webhooks page to inspect safe delivery metadata.</p></CardContent></Card>
      </div>
    </div>
  );
}
