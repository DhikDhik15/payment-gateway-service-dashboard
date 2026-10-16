import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import type {
  CreateProductRequest,
  Product,
  UpdateProductRequest,
} from '@/types';
import {
  buildProductDetailPath,
  buildProductsListPath,
  dashboardProductDetailQueryKey,
  dashboardProductsQueryKey,
  type ListProductsParams,
} from './productsQuery';

export type { ListProductsParams };
export {
  buildProductsListPath,
  buildProductDetailPath,
  dashboardProductDetailQueryKey,
  dashboardProductsQueryKey,
};

function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!(error instanceof ApiClientError) || error.status >= 500) && failureCount < 2;
}

export function useProducts(params: ListProductsParams) {
  const { user, isAuthenticated } = useAuth();
  const merchantId = user?.merchant_id;

  return useQuery({
    queryKey: dashboardProductsQueryKey(merchantId, params),
    enabled: isAuthenticated && !!merchantId,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const path = buildProductsListPath(params);
      return apiClient.get<Product[]>(path, { signal });
    },
  });
}

export function useProductDetail(productId?: string) {
  const { user, isAuthenticated } = useAuth();
  const merchantId = user?.merchant_id;

  return useQuery({
    queryKey: dashboardProductDetailQueryKey(merchantId, productId),
    enabled: isAuthenticated && !!productId && !!merchantId,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<Product>(
        buildProductDetailPath(productId ?? ''),
        { signal },
      );
      return response.data;
    },
  });
}

function useInvalidateProducts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const merchantId = user?.merchant_id;
  return () => {
    void queryClient.invalidateQueries({
      queryKey: ['dashboard-products', merchantId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['dashboard-product-detail', merchantId],
    });
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async ({ body }: { body: CreateProductRequest }) => {
      const response = await apiClient.post<Product>(
        '/api/v1/dashboard/products',
        body,
        // A 401 means the backend auth middleware rejected the request before
        // the handler ran, so one refresh-and-retry is safe even without a
        // backend idempotency key. The form still stays disabled while the
        // mutation (including its single retry) is pending.
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async ({
      productId,
      body,
    }: {
      productId: string;
      body: UpdateProductRequest;
    }) => {
      const response = await apiClient.patch<Product>(
        buildProductDetailPath(productId),
        body,
        { retryOnUnauthorized: true },
      );
      return response.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async ({ productId }: { productId: string }) => {
      await apiClient.delete(buildProductDetailPath(productId), {
        retryOnUnauthorized: true,
      });
      return productId;
    },
    onSuccess: () => invalidate(),
  });
}

export function useToggleProductActive() {
  const update = useUpdateProduct();
  return {
    ...update,
    toggle: (productId: string, active: boolean) =>
      update.mutate({ productId, body: { active } }),
  };
}
