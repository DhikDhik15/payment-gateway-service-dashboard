import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, Copy, KeyRound, ShieldCheck, UserPlus, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  ErrorState,
  Input,
  Label,
  SkeletonRow,
} from '@/components/ui';
import { useSettings, useUsers } from '@/hooks/useSettings';
import {
  useChangePassword,
  useCreateInvitation,
  useUpdateUserRole,
  useUpdateUserStatus,
} from '@/hooks/useTeam';
import { errorMessage, fieldError, isLastOwnerError, isMerchantInactiveError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import type { DashboardUserResponse, DashboardUserRole, DashboardUserStatus } from '@/types';

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(254),
  role: z.enum(['OWNER', 'ADMIN', 'VIEWER']),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters').max(128),
  confirm_password: z.string().min(1, 'Confirm your new password'),
}).refine((values) => values.new_password === values.confirm_password, {
  path: ['confirm_password'],
  message: 'Passwords do not match',
});

type InviteValues = z.infer<typeof inviteSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

function roleVariant(role: DashboardUserRole): 'primary' | 'outline' | 'default' {
  if (role === 'OWNER') return 'primary';
  if (role === 'ADMIN') return 'outline';
  return 'default';
}

function mutationErrorMessage(error: unknown): string {
  if (isLastOwnerError(error)) {
    return 'The merchant must keep at least one active OWNER. No changes were made.';
  }
  if (isMerchantInactiveError(error)) {
    return 'This merchant is not active, so team changes are currently unavailable.';
  }
  return errorMessage(error, 'The team change could not be completed.');
}

export function TeamManagementPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: users, isLoading, isError, error, refetch, isFetching } = useUsers();
  const { data: merchant } = useSettings();
  const inviteMutation = useCreateInvitation();
  const roleMutation = useUpdateUserRole();
  const statusMutation = useUpdateUserStatus();
  const passwordMutation = useChangePassword();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [invitation, setInvitation] = useState<{ email: string; role: DashboardUserRole; token: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, DashboardUserRole>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'VIEWER' },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const merchantActive = merchant?.status === 'ACTIVE';
  const canManage = user?.role === 'OWNER';

  useEffect(() => {
    if (users) {
      setRoleDrafts(Object.fromEntries(users.map((member) => [member.id, member.role])));
    }
  }, [users]);

  useEffect(() => {
    if (!inviteOpen && !passwordOpen) {
      setInvitation(null);
      setCopied(false);
      setActionError(null);
    }
  }, [inviteOpen, passwordOpen]);

  // A failed last-owner operation must be visible and the server remains the
  // source of truth. Refetching also repairs any stale role/status row.
  useEffect(() => {
    const mutationError = roleMutation.error ?? statusMutation.error;
    if (!mutationError) return;
    setActionError(mutationErrorMessage(mutationError));
    if (isLastOwnerError(mutationError)) void refetch();
  }, [roleMutation.error, statusMutation.error, refetch]);

  const invitationLink = useMemo(() => {
    if (!invitation || typeof window === 'undefined') return '';
    return `${window.location.origin}/accept-invitation?token=${encodeURIComponent(invitation.token)}`;
  }, [invitation]);

  const openInvite = () => {
    setActionError(null);
    inviteMutation.reset();
    inviteForm.reset({ email: '', role: 'VIEWER' });
    setInvitation(null);
    setInviteOpen(true);
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setInvitation(null);
    setCopied(false);
    inviteMutation.reset();
    inviteForm.reset({ email: '', role: 'VIEWER' });
  };

  const submitInvite = (values: InviteValues) => {
    setActionError(null);
    inviteMutation.mutate(
      { email: values.email.trim().toLowerCase(), role: values.role },
      {
        onSuccess: (result) => {
          setInvitation({
            email: result.email,
            role: result.role,
            token: result.token,
            expiresAt: result.expires_at,
          });
          inviteForm.reset({ email: '', role: 'VIEWER' });
        },
        onError: (mutationError) => setActionError(mutationErrorMessage(mutationError)),
      },
    );
  };

  const submitPassword = (values: PasswordValues) => {
    setActionError(null);
    passwordMutation.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      {
        onSuccess: async () => {
          await logout();
          navigate('/login', { replace: true, state: { message: 'Password changed. Please sign in again.' } });
        },
        onError: (mutationError) => setActionError(mutationErrorMessage(mutationError)),
      },
    );
  };

  const updateRole = (member: DashboardUserResponse) => {
    const role = roleDrafts[member.id] ?? member.role;
    if (role === member.role) return;
    setActionError(null);
    roleMutation.mutate({ userId: member.id, role });
  };

  const updateStatus = (member: DashboardUserResponse) => {
    const status: DashboardUserStatus = member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setActionError(null);
    statusMutation.mutate({ userId: member.id, status });
  };

  const columns = [
    {
      key: 'member',
      header: 'Member',
      render: (member: DashboardUserResponse) => (
        <div className="min-w-[180px]">
          <p className="font-medium">{member.email}{member.id === user?.id ? ' (you)' : ''}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{member.id}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (member: DashboardUserResponse) => (
        <div className="flex min-w-[130px] items-center gap-2">
          <Badge variant={roleVariant(member.role)}>{member.role}</Badge>
          {canManage && (
            <select
              aria-label={`Role for ${member.email}`}
              value={roleDrafts[member.id] ?? member.role}
              onChange={(event) => setRoleDrafts((current) => ({
                ...current,
                [member.id]: event.target.value as DashboardUserRole,
              }))}
              disabled={!merchantActive || roleMutation.isPending}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member: DashboardUserResponse) => (
        <Badge variant={member.status === 'ACTIVE' ? 'success' : 'default'}>{member.status}</Badge>
      ),
    },
    {
      key: 'last_login',
      header: 'Last active',
      render: (member: DashboardUserResponse) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {member.last_login_at ? formatDateTime(member.last_login_at) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'w-48',
      render: (member: DashboardUserResponse) => (
        <div className="flex items-center gap-1">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!merchantActive || roleMutation.isPending || (roleDrafts[member.id] ?? member.role) === member.role}
                onClick={() => updateRole(member)}
              >
                Save role
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!merchantActive || statusMutation.isPending || member.id === user?.id}
                onClick={() => updateStatus(member)}
                title={member.id === user?.id ? 'You cannot disable your own account' : undefined}
              >
                {member.status === 'ACTIVE' ? 'Disable' : 'Enable'}
              </Button>
            </>
          )}
          {!canManage && <span className="text-xs text-muted-foreground">Read only</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team members</h2>
          <p className="text-sm text-muted-foreground">Manage access to this merchant dashboard.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setActionError(null); setPasswordOpen(true); passwordForm.reset(); }}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Change my password
          </Button>
          <Button onClick={openInvite} disabled={!canManage || !merchantActive}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Invite member
          </Button>
        </div>
      </div>

      {!merchantActive && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Team mutations are disabled while the merchant is {merchant?.status?.toLowerCase() ?? 'not active'}.</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error" className="rounded p-1 hover:bg-danger/10">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
          ) : isError ? (
            <ErrorState
              title="Unable to load team"
              description={errorMessage(error, 'Team members could not be loaded.')}
              onRetry={() => void refetch()}
            />
          ) : users && users.length > 0 ? (
            <DataTable columns={columns} data={users} getRowKey={(member) => member.id} className="border-0 rounded-none" />
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">No team members found.</div>
          )}
          {isFetching && !isLoading && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground" role="status">Refreshing team…</p>}
        </CardContent>
      </Card>

      <Card className="border-info/20 bg-info/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Role permissions</CardTitle>
          <CardDescription>Permissions are enforced by the backend. The controls below only mirror its current policy.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div><Badge variant="primary">OWNER</Badge><p className="mt-1 text-xs text-muted-foreground">Full team and credential management</p></div>
          <div><Badge variant="outline">ADMIN</Badge><p className="mt-1 text-xs text-muted-foreground">Payment, refund, webhook, and API key mutations</p></div>
          <div><Badge>VIEWER</Badge><p className="mt-1 text-xs text-muted-foreground">Read-only dashboard access</p></div>
        </CardContent>
      </Card>

      <Dialog
        open={inviteOpen}
        onClose={closeInvite}
        title={invitation ? 'Invitation created' : 'Invite a team member'}
        description={invitation ? 'This invitation token is shown once. Send it through a secure channel.' : 'Only OWNER users can create invitations.'}
      >
        {invitation ? (
          <div className="space-y-4">
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert">
              <p className="font-semibold">One-time invitation link</p>
              <p className="mt-1 text-xs">It will not be shown again after you close this dialog.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invitation-email">Invited email</Label>
              <Input id="invitation-email" value={invitation.email} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invitation-link">Acceptance link</Label>
              <div className="flex gap-2">
                <Input id="invitation-link" value={invitationLink} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" aria-label="Copy invitation link" onClick={() => { void navigator.clipboard.writeText(invitationLink); setCopied(true); }}>
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Role: <strong>{invitation.role}</strong>. Expires: {formatDateTime(invitation.expiresAt)}.</p>
            <Button className="w-full" onClick={closeInvite}>I have securely shared the invitation</Button>
          </div>
        ) : (
          <form onSubmit={inviteForm.handleSubmit(submitInvite)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" required>Email address</Label>
              <Input id="invite-email" type="email" autoComplete="email" placeholder="teammate@example.com" {...inviteForm.register('email')} error={inviteForm.formState.errors.email?.message ?? fieldError(inviteMutation.error, 'email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role" required>Role</Label>
              <select id="invite-role" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...inviteForm.register('role')}>
                <option value="VIEWER">VIEWER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="OWNER">OWNER</option>
              </select>
            </div>
            {inviteMutation.isError && <p className="text-sm text-danger" role="alert">{mutationErrorMessage(inviteMutation.error)}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={closeInvite}>Cancel</Button>
              <Button type="submit" isLoading={inviteMutation.isPending} disabled={!merchantActive}>Create invitation</Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Change password" description="All refresh sessions will be revoked after a successful change.">
        <form onSubmit={passwordForm.handleSubmit(submitPassword)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="current-password" required>Current password</Label>
            <Input id="current-password" type="password" autoComplete="current-password" {...passwordForm.register('current_password')} error={passwordForm.formState.errors.current_password?.message ?? fieldError(passwordMutation.error, 'current_password')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" required>New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" {...passwordForm.register('new_password')} error={passwordForm.formState.errors.new_password?.message ?? fieldError(passwordMutation.error, 'new_password')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" required>Confirm new password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" {...passwordForm.register('confirm_password')} error={passwordForm.formState.errors.confirm_password?.message} />
          </div>
          {passwordMutation.isError && <p className="text-sm text-danger" role="alert">{mutationErrorMessage(passwordMutation.error)}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={passwordMutation.isPending}>Change password</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
