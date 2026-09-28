import { useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  SkeletonCard,
  ErrorState,
} from '@/components/ui';
import { TeamManagementPanel } from '@/components/team/TeamManagementPanel';
import { useSettings } from '@/hooks/useSettings';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'team'>('profile');
  const { data: settings, isLoading, isError, error, refetch } = useSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Review your merchant profile and team access."
      />

      <div className="flex border-b border-border" role="tablist" aria-label="Settings sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Merchant Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'team'}
          onClick={() => setActiveTab('team')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'team' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Team Management
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="max-w-3xl space-y-6">
          {isLoading ? <SkeletonCard /> : isError ? (
            <ErrorState
              title="Failed to load merchant profile"
              description={errorMessage(error)}
              onRetry={() => void refetch()}
            />
          ) : settings ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Merchant information</CardTitle>
                  <CardDescription>These details are read from the authenticated merchant context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div><p className="text-sm font-medium text-muted-foreground">Merchant name</p><p className="mt-1 font-semibold">{settings.name}</p></div>
                    <div><p className="text-sm font-medium text-muted-foreground">Merchant code</p><code className="mt-1 rounded bg-muted px-1.5 py-0.5 text-sm">{settings.code}</code></div>
                    <div><p className="text-sm font-medium text-muted-foreground">Merchant ID</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{settings.id}</p></div>
                    <div><p className="text-sm font-medium text-muted-foreground">Account status</p><Badge className="mt-1" variant={settings.status === 'ACTIVE' ? 'success' : 'warning'}>{settings.status}</Badge></div>
                    <div><p className="text-sm font-medium text-muted-foreground">Created</p><p className="mt-1 text-sm">{formatDateTime(settings.created_at)}</p></div>
                    <div><p className="text-sm font-medium text-muted-foreground">Last updated</p><p className="mt-1 text-sm">{formatDateTime(settings.updated_at)}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Credential migration state</CardTitle>
                  <CardDescription>This state contains no credential material.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant={settings.legacy_credential_state === 'LEGACY_DISABLED' ? 'default' : 'info'}>{settings.legacy_credential_state}</Badge>
                  {settings.legacy_credential_disabled_at && <p className="mt-2 text-xs text-muted-foreground">Disabled: {formatDateTime(settings.legacy_credential_disabled_at)}</p>}
                </CardContent>
              </Card>
            </>
          ) : <ErrorState title="Merchant profile unavailable" />}
        </div>
      ) : <TeamManagementPanel />}
    </div>
  );
}
