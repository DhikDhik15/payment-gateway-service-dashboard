import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, AlertTriangle, Info } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  Dialog,
  Input,
  Label,
  SkeletonRow,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useApiKeys';
import { LegacyCredentialCard } from '@/components/keys/LegacyCredentialCard';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage, fieldError, isMerchantInactiveError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canManageApiKeys } from '@/lib/auth/permissions';
import { formatDateTime, dateOnlyToRFC3339EndOfDay } from '@/lib/utils';
import type { MerchantAPIKeyResponse } from '@/types';

const keySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Maximum 100 characters'),
  expires_at: z.string().optional(),
});
type KeyFormValues = z.infer<typeof keySchema>;

export function ApiKeysPage() {
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const { data, isLoading, isError, error, refetch } = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ key_id: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<'id' | 'secret' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<KeyFormValues>({ resolver: zodResolver(keySchema), defaultValues: { name: '', expires_at: '' } });

  const canManage = canManageApiKeys(user?.role);
  const merchantActive = merchant?.status === 'ACTIVE';

  const closeDialog = () => {
    setDialogOpen(false);
    setCreatedKey(null);
    setShowSecret(false);
    setCopied(null);
    setFormError(null);
    createMutation.reset();
    form.reset({ name: '', expires_at: '' });
  };

  const openDialog = () => {
    if (!canManage || !merchantActive) return;
    setFormError(null);
    createMutation.reset();
    form.reset({ name: '', expires_at: '' });
    setCreatedKey(null);
    setDialogOpen(true);
  };

  const submit = (values: KeyFormValues) => {
    if (!canManage || !merchantActive || createMutation.isPending) return;
    setFormError(null);
    let expiresAt: string | undefined;
    try {
      expiresAt = dateOnlyToRFC3339EndOfDay(values.expires_at);
    } catch (errorValue) {
      setFormError(errorValue instanceof Error ? errorValue.message : 'Enter a valid expiration date.');
      return;
    }
    createMutation.mutate(
      { name: values.name.trim(), expires_at: expiresAt ?? null },
      { onSuccess: (result) => setCreatedKey({ key_id: result.key_id, secret: result.secret }) },
    );
  };

  const copy = async (value: 'id' | 'secret') => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(value === 'id' ? createdKey.key_id : createdKey.secret);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 2_000);
    } catch {
      setFormError('Copy failed. Select the value and copy it manually.');
    }
  };

  const revoke = (key: MerchantAPIKeyResponse) => {
    if (!canManage || !merchantActive || revokeMutation.isPending) return;
    if (!window.confirm(`Revoke “${key.name}”? Applications using this key will stop authenticating immediately.`)) return;
    revokeMutation.mutate(key.id, { onError: (mutationError) => setFormError(errorMessage(mutationError)) });
  };

  const columns = [
    { key: 'name', header: 'Name', render: (key: MerchantAPIKeyResponse) => <span className="font-medium">{key.name}</span> },
    { key: 'key_id', header: 'Key ID', render: (key: MerchantAPIKeyResponse) => <code className="text-xs">{key.key_id}</code> },
    { key: 'status', header: 'Status', render: (key: MerchantAPIKeyResponse) => <Badge variant={key.status === 'ACTIVE' ? 'success' : 'default'}>{key.status}</Badge> },
    { key: 'created_at', header: 'Created', render: (key: MerchantAPIKeyResponse) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(key.created_at)}</span> },
    { key: 'expires_at', header: 'Expires', render: (key: MerchantAPIKeyResponse) => <span className="whitespace-nowrap text-xs text-muted-foreground">{key.expires_at ? formatDateTime(key.expires_at) : 'Never'}</span> },
    { key: 'last_used', header: 'Last used', render: (key: MerchantAPIKeyResponse) => <span className="whitespace-nowrap text-xs text-muted-foreground">{key.last_used_at ? formatDateTime(key.last_used_at) : 'Never'}</span> },
    { key: 'actions', header: '', headerClassName: 'w-12', render: (key: MerchantAPIKeyResponse) => key.status === 'ACTIVE' ? <Button variant="ghost" size="icon" aria-label={`Revoke ${key.name}`} disabled={!canManage || !merchantActive || revokeMutation.isPending} onClick={() => revoke(key)} title={!canManage ? 'OWNER or ADMIN role required' : undefined}><Trash2 className="h-4 w-4 text-danger" aria-hidden="true" /></Button> : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="API Keys" description="Manage credentials for integrating PayGate into your application." actions={<Button onClick={openDialog} disabled={!canManage || !merchantActive} title={!canManage ? 'OWNER or ADMIN role required' : !merchantActive ? 'Merchant is not active' : undefined}><Plus className="h-4 w-4" aria-hidden="true" /> Create key</Button>} />

      {!canManage && <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-sm text-info" role="status"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Your VIEWER role can inspect metadata but cannot create or revoke credentials.</div>}
      {revokeMutation.isError && <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{errorMessage(revokeMutation.error)}</div>}

      <LegacyCredentialCard />

      <Card><CardContent className="p-0">
        {isLoading ? <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /></div> : isError ? <ErrorState title="Unable to load API keys" description={errorMessage(error, 'API key metadata could not be loaded.')} onRetry={() => void refetch()} /> : data && data.length > 0 ? <DataTable columns={columns} data={data} getRowKey={(key) => key.id} className="border-0 rounded-none" /> : <EmptyState title="No API keys" description="Create an API key to start integrating with PayGate." icon={<Key className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}
      </CardContent></Card>

      <Card className="border-info/20 bg-info/5"><CardContent className="flex items-start gap-2 p-4 text-sm text-info"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p className="text-xs">The current dashboard API exposes create and revoke operations. It does not expose an atomic dashboard rotate endpoint; use a controlled replacement procedure or the merchant API-key lifecycle endpoint rather than claiming an unverified rotation.</p></CardContent></Card>

      <Dialog open={dialogOpen} onClose={closeDialog} title={createdKey ? 'Key created' : 'Create API key'} description={createdKey ? 'Copy the secret now. It will not be shown again.' : 'Give this key a name to identify it later.'}>
        {createdKey ? <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-warning bg-warning/5 p-4"><div className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" aria-hidden="true" /><p className="text-sm font-semibold">One-time secret display</p></div><p className="text-xs text-muted-foreground">This secret is never retrievable after you close this dialog. Store it in your secret manager.</p></div>
          <div className="space-y-2"><Label htmlFor="created-key-id">Key ID</Label><div className="flex items-center gap-2 rounded-md border bg-muted p-2"><code className="flex-1 break-all text-xs">{createdKey.key_id}</code><Button type="button" variant="ghost" size="icon" aria-label="Copy key ID" onClick={() => void copy('id')}>{copied === 'id' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}</Button></div></div>
          <div className="space-y-2"><Label htmlFor="created-key-secret">Secret key</Label><div className="flex items-center gap-2 rounded-md border bg-muted p-2"><code className="flex-1 break-all text-xs">{showSecret ? createdKey.secret : '••••••••••••••••••••••••••••••••'}</code><Button type="button" variant="ghost" size="icon" aria-label={showSecret ? 'Hide secret key' : 'Show secret key'} onClick={() => setShowSecret((value) => !value)}>{showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</Button><Button type="button" variant="ghost" size="icon" aria-label="Copy secret key" onClick={() => void copy('secret')}>{copied === 'secret' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}</Button></div></div>
          <Button className="w-full" onClick={closeDialog}>I have saved the secret</Button>
        </div> : <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <div className="space-y-2"><Label htmlFor="key-name" required>Key name</Label><Input id="key-name" placeholder="e.g. Production mobile app" {...form.register('name')} error={form.formState.errors.name?.message ?? fieldError(createMutation.error, 'name')} /></div>
          <div className="space-y-2"><Label htmlFor="key-expiry">Expiration (optional)</Label><Input id="key-expiry" type="date" {...form.register('expires_at')} /><p className="text-xs text-muted-foreground">Leave empty for a key that does not expire.</p></div>
          {(formError || createMutation.isError) && <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{formError ?? (isMerchantInactiveError(createMutation.error) ? 'The merchant is not active, so no key was created.' : errorMessage(createMutation.error))}</div>}
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button><Button type="submit" isLoading={createMutation.isPending} disabled={!canManage || !merchantActive}>Create key</Button></div>
        </form>}
      </Dialog>
    </div>
  );
}
