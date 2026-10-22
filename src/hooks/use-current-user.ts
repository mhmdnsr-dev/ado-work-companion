'use client';

import { useQuery } from '@tanstack/react-query';

import { adoQueryKeys } from '@core/constants';
import type { AuthenticatedUser } from '@core/types';
import { useConnection } from '@/components/providers';

/**
 * Resolves the signed-in Azure DevOps identity once per organization.
 * Used to preselect the current user in member/assignee dropdowns.
 */
export function useCurrentUser() {
  const { api, settings } = useConnection();
  const organization = settings.organization;

  const query = useQuery({
    queryKey: adoQueryKeys.dashboard.currentUser(organization),
    enabled: Boolean(api && organization),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.getAuthenticatedUser({ signal });
    },
  });

  const currentUser = query.data?.data ?? null;

  return {
    currentUser,
    currentUserId: currentUser?.id ?? null,
    currentUserName:
      currentUser?.providerDisplayName?.trim() ||
      currentUser?.customDisplayName?.trim() ||
      '',
    isLoading: query.isLoading,
  } satisfies {
    currentUser: AuthenticatedUser | null;
    currentUserId: string | null;
    currentUserName: string;
    isLoading: boolean;
  };
}
