import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface LegacyMigrationResponse {
  id: string;
  merchant_id: string;
  name: string;
  key_id: string;
  secret: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  legacy_credential_state: 'MIGRATED';
  legacy_disabled: boolean;
}

export interface LegacyDisableResponse {
  legacy_credential_state: 'LEGACY_DISABLED';
  legacy_credential_disabled_at: string;
  already_disabled: boolean;
}

export function useMigrateLegacyCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const response = await apiClient.post<LegacyMigrationResponse>(
        '/api/v1/dashboard/legacy-credential/migrate',
        undefined,
        { retryOnUnauthorized: false },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-api-keys'] });
    },
  });
}

export function useDisableLegacyCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const response = await apiClient.post<LegacyDisableResponse>(
        '/api/v1/dashboard/legacy-credential/disable',
        undefined,
        { retryOnUnauthorized: false },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-api-keys'] });
    },
  });
}
