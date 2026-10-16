import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { passwordResetConfirmPath, passwordResetRequestPath } from '@/lib/password-reset/contract';

const publicMutationOptions = {
  skipAuth: true,
  skipRefresh: true,
  credentials: 'omit',
  retryOnUnauthorized: false,
} as const;

export function useRequestPasswordReset() {
  return useMutation({
    gcTime: 0,
    mutationFn: async (email: string) => {
      const response = await apiClient.post<{ message: string }>(
        passwordResetRequestPath(),
        { email },
        { ...publicMutationOptions },
      );
      return response.data;
    },
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    gcTime: 0,
    mutationFn: async (input: { token: string; password: string }) => {
      const response = await apiClient.post<{ message: string }>(
        passwordResetConfirmPath(),
        input,
        { ...publicMutationOptions },
      );
      return response.data;
    },
  });
}
