/**
 * Pure helpers for dashboard product/category React Query keys and paths.
 * Kept free of React / @/ imports so node:test can import them directly.
 */

export interface ListProductsParams {
  page?: number;
  limit?: number;
  category_id?: string;
  active?: boolean;
  search?: string;
}

/** Cache key only — merchantId must never be added to the HTTP query string. */
export function dashboardProductsQueryKey(
  merchantId: string | undefined,
  params: ListProductsParams,
) {
  return ['dashboard-products', merchantId, params] as const;
}

/** Cache key only — merchantId must never be added to the HTTP path/query. */
export function dashboardProductDetailQueryKey(
  merchantId: string | undefined,
  productId: string | undefined,
) {
  return ['dashboard-product-detail', merchantId, productId] as const;
}

export function dashboardCategoriesQueryKey(merchantId: string | undefined) {
  return ['dashboard-categories', merchantId] as const;
}

/** Cache key only — merchantId must never be added to the HTTP path/query. */
export function dashboardCategoryDetailQueryKey(
  merchantId: string | undefined,
  categoryId: string | undefined,
) {
  return ['dashboard-category-detail', merchantId, categoryId] as const;
}

const allowedProductFilters = new Set<keyof ListProductsParams>([
  'page',
  'limit',
  'category_id',
  'active',
  'search',
]);

/**
 * Builds GET /api/v1/dashboard/products?... from list params.
 * Intentionally omits merchant_id — backend derives merchant from JWT.
 * Blank search strings are omitted so empty input lists everything.
 */
export function buildProductsListPath(params: ListProductsParams): string {
  for (const key of Object.keys(params)) {
    if (!allowedProductFilters.has(key as keyof ListProductsParams)) {
      throw new Error(`Unsupported product list filter: ${key}`);
    }
  }
  const q = new URLSearchParams();
  if (params.page !== undefined) q.set('page', String(params.page));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  if (params.category_id) q.set('category_id', params.category_id);
  if (params.active !== undefined) q.set('active', String(params.active));
  const search = params.search?.trim();
  if (search) q.set('search', search);
  const queryStr = q.toString();
  return `/api/v1/dashboard/products${queryStr ? `?${queryStr}` : ''}`;
}

export function buildProductDetailPath(productId: string): string {
  return `/api/v1/dashboard/products/${encodeURIComponent(productId)}`;
}

export function buildCategoriesListPath(): string {
  return '/api/v1/dashboard/categories';
}

export function buildCategoryDetailPath(categoryId: string): string {
  return `/api/v1/dashboard/categories/${encodeURIComponent(categoryId)}`;
}
