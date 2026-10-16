import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { useRequestPasswordReset } from '@/hooks/usePasswordReset';
import { errorMessage } from '@/lib/api';
import { forgotPasswordSchema, passwordResetRequestMessage } from '@/lib/password-reset/contract';
import type { ForgotPasswordValues } from '@/lib/password-reset/contract';

export function ForgotPasswordPage() {
  const requestMutation = useRequestPasswordReset();
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = (values: ForgotPasswordValues) => {
    if (requestMutation.isPending) return;
    requestMutation.mutate(values.email.trim());
  };

  if (requestMutation.isSuccess) {
    return (
      <div className="w-full max-w-md">
        <Card className="border-success/30">
          <CardContent className="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground" role="status">{passwordResetRequestMessage}</p>
            <Button variant="outline" asChild>
              <Link to="/login" replace>Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" aria-hidden="true" /> Forgot password</CardTitle>
          <CardDescription>Enter your account email and we will send you a password-reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" required>Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...form.register('email')}
                error={form.formState.errors.email?.message}
              />
            </div>
            {requestMutation.isError && (
              <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
                {errorMessage(requestMutation.error, 'Unable to send the reset email right now.')}
              </div>
            )}
            <Button type="submit" className="w-full" isLoading={requestMutation.isPending}>Send reset link</Button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link to="/login" replace className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
