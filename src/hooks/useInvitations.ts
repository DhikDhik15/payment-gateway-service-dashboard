import { useId } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { invitationAcceptPath, invitationResourcePath } from '@/lib/invitations/contract';
import type { InvitationMetadataResponse, DashboardUserResponse } from '@/types';

export function useInvitationMetadata(token?: string) {
  const instanceId = useId();
  return useQuery({
    // The raw bearer token is deliberately not part of the cache key. The
    // public preview response contains no token and is not reusable elsewhere.
    queryKey: ['invitation-metadata', instanceId],
    enabled: !!token,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<InvitationMetadataResponse>(
        invitationResourcePath(token ?? ''),
        { skipAuth: true, skipRefresh: true, credentials: 'omit', signal },
      );
      return response.data;
    },
  });
}

export function useAcceptInvitation(token?: string) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (password: string) => {
      const response = await apiClient.post<DashboardUserResponse>(
        invitationAcceptPath(token ?? ''),
        { password },
        { skipAuth: true, skipRefresh: true, credentials: 'omit', retryOnUnauthorized: false },
      );
      return response.data;
    },
  });
}
