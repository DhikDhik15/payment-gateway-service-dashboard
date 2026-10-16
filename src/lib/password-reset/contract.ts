/** Backend password-reset route helpers. Tokens travel in the request body (never query). */
import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address'),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be 128 characters or fewer'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export function passwordResetRequestPath(): string {
  return '/api/v1/auth/password-reset/request';
}

export function passwordResetConfirmPath(): string {
  return '/api/v1/auth/password-reset/confirm';
}

export function resetErrorMessage(code: string | undefined, fallback = 'This reset link is no longer available.'): string {
  switch (code) {
    case 'RESET_TOKEN_INVALID':
      return 'This reset link is invalid. Request a new one below.';
    case 'RESET_TOKEN_EXPIRED':
      return 'This reset link has expired. Request a new one below.';
    case 'RESET_TOKEN_CONSUMED':
      return 'This reset link has already been used. Request a new one below.';
    case 'INVALID_PASSWORD':
      return 'Password must be 8–128 characters.';
    default:
      return fallback;
  }
}

export const passwordResetRequestMessage =
  'If an account exists for this email, a password-reset link has been sent.';

export const passwordResetSuccessMessage =
  'Your password has been reset. Sign in with your new password.';
