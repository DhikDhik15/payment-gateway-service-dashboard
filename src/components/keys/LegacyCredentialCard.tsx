import { useState } from 'react';
import { AlertTriangle, Check, Copy, KeyRound, ShieldAlert } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Badge } from '@/components/ui';
import { useDisableLegacyCredential, useMigrateLegacyCredential } from '@/hooks/useLegacyCredential';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage, isMerchantInactiveError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function LegacyCredentialCard() {
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const migrate = useMigrateLegacyCredential();
  const disable = useDisableLegacyCredential();
  const [secret, setSecret] = useState<{ keyId: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const active = merchant?.status === 'ACTIVE';
  const state = merchant?.legacy_credential_state;

  if (!merchant || !state || state === 'LEGACY_DISABLED') return null;

  const copy = async () => {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret.secret); setCopied(true); window.setTimeout(() => setCopied(false), 2_000); } catch { setCopied(false); }
  };

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" /> Legacy credential migration</CardTitle>
        <CardDescription>Legacy credentials are a compatibility mechanism. Migrate before disabling them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="warning">{state}</Badge><span className="text-xs text-muted-foreground">No legacy secret is ever displayed by this page.</span></div>
        {secret ? <div className="space-y-3 rounded-md border border-warning/40 bg-background p-3"><div className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> New API secret shown once</div><div className="space-y-1.5"><Label htmlFor="migrated-key-id">Key ID</Label><Input id="migrated-key-id" value={secret.keyId} readOnly /></div><div className="space-y-1.5"><Label htmlFor="migrated-secret">Secret</Label><div className="flex gap-2"><Input id="migrated-secret" type={showSecret ? 'text' : 'password'} value={secret.secret} readOnly className="font-mono text-xs" /><Button type="button" variant="outline" size="sm" onClick={() => setShowSecret((value) => !value)}>{showSecret ? 'Hide' : 'Show'}</Button><Button type="button" variant="outline" size="icon" aria-label="Copy migrated secret" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}</Button></div></div><Button type="button" size="sm" onClick={() => { setSecret(null); setShowSecret(false); setCopied(false); migrate.reset(); }}>I have saved the secret</Button></div> : <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!canManage || !active || migrate.isPending} onClick={() => migrate.mutate(undefined, { onSuccess: (result) => setSecret({ keyId: result.key_id, secret: result.secret }) })}><KeyRound className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Migrate legacy credential</Button>{state === 'MIGRATED' && <Button size="sm" variant="outline" disabled={!canManage || !active || disable.isPending} onClick={() => { if (window.confirm('Disable the legacy credential? Applications still using it will stop working.')) disable.mutate(); }}>Disable legacy credential</Button>}</div>}
        {(migrate.isError || disable.isError) && <p className="text-sm text-danger" role="alert">{isMerchantInactiveError(migrate.error ?? disable.error) ? 'The merchant is not active, so no credential change was made.' : errorMessage(migrate.error ?? disable.error)}</p>}
      </CardContent>
    </Card>
  );
}
