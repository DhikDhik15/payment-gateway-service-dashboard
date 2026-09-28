import { useLayoutEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { useAcceptInvitation, useInvitationMetadata } from '@/hooks/useInvitations';
import { errorMessage, fieldError, isErrorCode } from '@/lib/api';
import { invitationErrorMessage } from '@/lib/invitations/contract';

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be 128 characters or fewer'),
});

type PasswordValues = z.infer<typeof passwordSchema>;

export function InvitationAcceptancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => searchParams.get('token') ?? '');
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null);
  const metadataQuery = useInvitationMetadata(token || undefined);
  const acceptMutation = useAcceptInvitation(token || undefined);
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { password: '' } });

  useLayoutEffect(() => {
    if (!token || typeof window === 'undefined') return;
    // The backend's token flow uses a query parameter, but it should not remain
    // in browser history or the router's location state after capture.
    setSearchParams({}, { replace: true });
  }, [token, setSearchParams]);

  const submit = (values: PasswordValues) => {
    if (!token) return;
    acceptMutation.mutate(values.password, {
      onSuccess: (user) => {
        setToken('');
        setAcceptedEmail(user.email);
        // The acceptance endpoint creates a user but does not issue a session.
        window.setTimeout(() => {
          void navigate('/login', { replace: true, state: { message: `Invitation accepted for ${user.email}. Please sign in.` } });
        }, 1_200);
      },
    });
  };

  if (acceptedEmail) {
    return (
      <div className="flex min-h-[50vh] w-full max-w-md items-center justify-center">
        <Card className="w-full border-success/30">
          <CardContent className="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Invitation accepted</h1>
            <p className="text-sm text-muted-foreground">Your account for {acceptedEmail} is ready. Redirecting you to sign in…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return <InvitationError title="Invitation link is missing" description="Open the invitation link provided by your merchant owner." />;
  }

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" aria-hidden="true" /> Accept team invitation</CardTitle>
          <CardDescription>Create your dashboard password to join the merchant team.</CardDescription>
        </CardHeader>
        <CardContent>
          {metadataQuery.isLoading ? (
            <div className="space-y-3" role="status" aria-live="polite">
              <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <p className="text-sm text-muted-foreground">Checking invitation…</p>
            </div>
          ) : metadataQuery.isError ? (
            <InvitationError
              title="Invitation unavailable"
              description={isErrorCode(metadataQuery.error, 'INVITATION_NOT_FOUND')
                ? invitationErrorMessage('INVITATION_NOT_FOUND')
                : errorMessage(metadataQuery.error)}
            />
          ) : metadataQuery.data ? (
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{metadataQuery.data.merchant_name}</p>
                <p className="mt-1 text-muted-foreground">{metadataQuery.data.email}</p>
                <p className="mt-2 text-xs text-muted-foreground">Role: <strong>{metadataQuery.data.role}</strong></p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invitation-password" required>Create password</Label>
                <Input id="invitation-password" type="password" autoComplete="new-password" {...form.register('password')} error={form.formState.errors.password?.message ?? fieldError(acceptMutation.error, 'password')} />
                <p className="text-xs text-muted-foreground">Use 8–128 characters. Your password is never stored in this browser.</p>
              </div>
              {acceptMutation.isError && (
                <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
                  {isErrorCode(acceptMutation.error, 'INVITATION_ALREADY_ACCEPTED')
                    ? 'This invitation has already been accepted.'
                    : isErrorCode(acceptMutation.error, 'EMAIL_ALREADY_EXISTS')
                      ? 'An account with this email already exists.'
                      : isErrorCode(acceptMutation.error, 'MERCHANT_INACTIVE')
                        ? 'This merchant is not active, so the invitation cannot be accepted.'
                        : errorMessage(acceptMutation.error)}
                </div>
              )}
              <Button type="submit" className="w-full" isLoading={acceptMutation.isPending}>Accept invitation</Button>
            </form>
          ) : <InvitationError title="Invitation unavailable" description="No invitation metadata was returned." />}
        </CardContent>
      </Card>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Invitation tokens are single-use.</p>
    </div>
  );
}

function InvitationError({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-danger/20">
      <CardContent className="space-y-3 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" onClick={() => { window.location.href = '/login'; }}>Go to sign in</Button>
      </CardContent>
    </Card>
  );
}
