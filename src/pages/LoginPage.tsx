import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button, Card, CardContent, Input, Label } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ApiClientError } from '@/lib/api/client';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading: authLoading, sessionExpired, sessionEndReason } = useAuth();
  const locationState = location.state as { from?: string; message?: string } | null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values);
      const from = locationState?.from && locationState.from.startsWith('/dashboard')
        ? locationState.from
        : '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      const message = error instanceof ApiClientError && error.code === 'USER_DISABLED'
        ? 'This account has been disabled. Contact your merchant owner.'
        : errorMessage(error, 'Unable to sign in right now.');
      setError('root', { message });
    }
  };

  const busy = isSubmitting || authLoading;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your merchant dashboard</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {(sessionExpired || locationState?.message) && (
            <div className="mb-4 rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm text-info" role="status">
              {locationState?.message ?? (sessionEndReason === 'merchant_inactive' ? 'This merchant is inactive or suspended. Contact PayGate support.' : sessionEndReason === 'user_disabled' ? 'This account has been disabled. Contact your merchant owner.' : 'Your session expired. Please sign in again.')}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {errors.root && <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{errors.root.message}</div>}

            <div className="space-y-1.5">
              <Label htmlFor="email" required>Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" hasError={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
              {errors.email && <p id="email-error" role="alert" className="text-xs text-danger">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" required>Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot Password?</Link>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" hasError={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} className="pr-10" {...register('password')} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className={cn('absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md')}>
                  {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p id="password-error" role="alert" className="text-xs text-danger">{errors.password.message}</p>}
            </div>

            <Button type="submit" variant="primary" size="lg" isLoading={busy} className="mt-2 w-full">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">Need access? Ask your merchant owner to invite you.</p>
    </div>
  );
}
