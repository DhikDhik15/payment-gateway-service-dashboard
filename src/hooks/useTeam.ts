import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { canManageTeam } from '@/lib/auth/permissions';
import type {
  CreateInvitationRequest,
  CreateInvitationResponse,
  DashboardUserResponse,
  DashboardUserRole,
  DashboardUserStatus,
} from '@/types';

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateInvitationRequest) => {
      const response = await apiClient.post<CreateInvitationResponse>(
        '/api/v1/dashboard/users/invite',
        body,
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
    onSuccess: () => {
      // Invitation list is not exposed by the backend, but invalidating users
      // keeps the team view ready if the invitation is accepted in another tab.
      void queryClient.invalidateQueries({ queryKey: ['dashboard-users'] });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: DashboardUserStatus }) => {
      const response = await apiClient.patch<DashboardUserResponse>(
        `/api/v1/dashboard/users/${encodeURIComponent(userId)}/status`,
        { status },
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-users'] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: DashboardUserRole }) => {
      const response = await apiClient.patch<DashboardUserResponse>(
        `/api/v1/dashboard/users/${encodeURIComponent(userId)}/role`,
        { role },
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-users'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: ChangePasswordRequest) => {
      const response = await apiClient.patch<DashboardUserResponse>(
        '/api/v1/dashboard/me/password',
        body,
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
  });
}

/** UX-only capability hint. The backend remains the authorization authority. */
export function useTeamCapabilities() {
  const { user } = useAuth();
  return {
    canManageTeam: canManageTeam(user?.role),
    canChangeOwnPassword: !!user,
  };
}
