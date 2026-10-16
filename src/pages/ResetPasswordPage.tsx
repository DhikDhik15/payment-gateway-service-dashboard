import { useLayoutEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { useConfirmPasswordReset } from '@/hooks/usePasswordReset';
import { errorMessage, fieldError, isErrorCode } from '@/lib/api';
import { passwordResetSuccessMessage, resetErrorMessage, resetPasswordSchema } from '@/lib/password-reset/contract';
import type { ResetPasswordValues } from '@/lib/password-reset/contract';

export function ResetPasswordPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => searchParams.get('token') ?? '');
  const [succeeded, setSucceeded] = useState(false);
  const confirmMutation = useConfirmPasswordReset();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useLayoutEffect(() => {
    if (!token || typeof window === 'undefined') return;
    // The reset token arrives as a query parameter but must not remain in
    // browser history or the router's location state after capture.
    setSearchParams({}, { replace: true });
  }, [token, setSearchParams]);

  const submit = (values: ResetPasswordValues) => {
    if (!token || confirmMutation.isPending) return;
    confirmMutation.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          // Drop the token from memory; the success screen carries no token.
          setToken('');
          setSucceeded(true);
        },
      },
    );
  };

  const goToLogin = () => {
    // Replace the history entry so the back button cannot resurface a
    // token-bearing URL.
    void navigate('/login', { replace: true, state: { message: passwordResetSuccessMessage } });
  };

  if (succeeded) {
    return (
      <div className="w-full max-w-md">
        <Card className="border-success/30">
          <CardContent className="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Password reset</h1>
            <p className="text-sm text-muted-foreground" role="status">{passwordResetSuccessMessage}</p>
            <Button className="w-full" onClick={goToLogin}>Back to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return <ResetError title="Reset link is missing" description="Open the password-reset link from your email." />;
  }

  const mutationError = confirmMutation.error;
  const linkDead = isErrorCode(mutationError, 'RESET_TOKEN_INVALID', 'RESET_TOKEN_EXPIRED', 'RESET_TOKEN_CONSUMED');

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" aria-hidden="true" /> Reset password</CardTitle>
          <CardDescription>Choose a new password for your dashboard account.</CardDescription>
        </CardHeader>
        <CardContent>
          {linkDead ? (
            <div className="space-y-4 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
              <p className="text-sm text-muted-foreground" role="alert">{resetErrorMessage(isErrorCode(mutationError, 'RESET_TOKEN_INVALID') ? 'RESET_TOKEN_INVALID' : isErrorCode(mutationError, 'RESET_TOKEN_EXPIRED') ? 'RESET_TOKEN_EXPIRED' : 'RESET_TOKEN_CONSUMED')}</p>
              <Button variant="outline" asChild>
                <Link to="/forgot-password" replace>Request a new link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="reset-password" required>New password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('password')}
                  error={form.formState.errors.password?.message ?? fieldError(mutationError, 'password')}
                />
                <p className="text-xs text-muted-foreground">Use 8–128 characters.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm-password" required>Confirm new password</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('confirmPassword')}
                  error={form.formState.errors.confirmPassword?.message}
                />
              </div>
              {confirmMutation.isError && !linkDead && (
                <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
                  {errorMessage(mutationError, 'Unable to reset your password right now.')}
                </div>
              )}
              <Button type="submit" className="w-full" isLoading={confirmMutation.isPending}>Reset password</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Reset links are single-use.</p>
    </div>
  );
}

function ResetError({ title, description }: { title: string; description: string }) {
  return (
    <div className="w-full max-w-md">
      <Card className="border-danger/20">
        <CardContent className="space-y-3 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button variant="outline" asChild>
            <Link to="/forgot-password" replace>Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
