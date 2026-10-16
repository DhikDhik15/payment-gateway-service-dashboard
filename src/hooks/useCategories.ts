import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@/types';
import {
  buildCategoriesListPath,
  buildCategoryDetailPath,
  dashboardCategoriesQueryKey,
  dashboardCategoryDetailQueryKey,
} from './productsQuery';

export {
  buildCategoriesListPath,
  buildCategoryDetailPath,
  dashboardCategoriesQueryKey,
  dashboardCategoryDetailQueryKey,
};

function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2;
}

export function useCategories() {
  const { user, isAuthenticated } = useAuth();
  const merchantId = user?.merchant_id;

  return useQuery({
    queryKey: dashboardCategoriesQueryKey(merchantId),
    enabled: isAuthenticated && !!merchantId,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const path = buildCategoriesListPath();
      return apiClient.get<Category[]>(path, { signal });
    },
  });
}

export function useCategoryDetail(categoryId?: string) {
  const { user, isAuthenticated } = useAuth();
  const merchantId = user?.merchant_id;

  return useQuery({
    queryKey: dashboardCategoryDetailQueryKey(merchantId, categoryId),
    enabled: isAuthenticated && !!categoryId && !!merchantId,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<Category>(
        buildCategoryDetailPath(categoryId ?? ''),
        { signal },
      );
      return response.data;
    },
  });
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const merchantId = user?.merchant_id;
  return () => {
    void queryClient.invalidateQueries({
      queryKey: ['dashboard-categories', merchantId],
    });
    // Product rows embed category names/links, so refresh them too.
    void queryClient.invalidateQueries({
      queryKey: ['dashboard-products', merchantId],
    });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async ({ body }: { body: CreateCategoryRequest }) => {
      const response = await apiClient.post<Category>(
        '/api/v1/dashboard/categories',
        body,
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async ({
      categoryId,
      body,
    }: {
      categoryId: string;
      body: UpdateCategoryRequest;
    }) => {
      const response = await apiClient.patch<Category>(
        buildCategoryDetailPath(categoryId),
        body,
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async ({ categoryId }: { categoryId: string }) => {
      await apiClient.delete(buildCategoryDetailPath(categoryId), {
        retryOnUnauthorized: true,
      });
      return categoryId;
    },
    onSuccess: () => invalidate(),
  });
}
