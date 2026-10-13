import { apiClient } from '../api/client';
import type { DashboardRole } from '@/types/auth';

/**
 * Dashboard product-image helpers and API calls.
 *
 * Backend contract (frontend consumption only; backend code is untouched):
 * - POST /api/v1/dashboard/product-images with multipart/form-data field
 *   `image` returns `{ success: true, data: { image_url } }`.
 * - DELETE /api/v1/dashboard/products/:product_id/image removes the
 *   persisted image. The shared client tolerates both the standard success
 *   envelope and an empty (204) response; failures surface as
 *   ApiClientError, so callers retain the existing image on error.
 * - The backend accepts JPEG and PNG; the configured backend limit applies.
 *   Client-side checks mirror the 5 MiB ceiling but backend validation
 *   remains authoritative.
 */

export const PRODUCT_IMAGE_UPLOAD_PATH = '/api/v1/dashboard/product-images';

/** Client-side ceiling mirroring the configured backend limit. */
export const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const PRODUCT_IMAGE_ACCEPTED_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
];

/** Value for the file input `accept` attribute. */
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png';

export const PRODUCT_IMAGE_TYPE_ERROR = 'Only JPG and PNG images are supported.';
export const PRODUCT_IMAGE_SIZE_ERROR = 'Image must be 5 MB or smaller.';

export interface ProductImageFileLike {
  type?: string;
  size?: number;
  name?: string;
}

export interface ProductImageUploadResponse {
  image_url: string;
}

/**
 * Client-side file validation. Returns an error message, or null when the
 * file may be uploaded. Backend validation remains authoritative.
 */
export function validateProductImageFile(file: ProductImageFileLike): string | null {
  const size = typeof file.size === 'number' ? file.size : 0;
  if (size > PRODUCT_IMAGE_MAX_SIZE_BYTES) return PRODUCT_IMAGE_SIZE_ERROR;
  const type = (file.type ?? '').trim().toLowerCase();
  if (type) {
    return PRODUCT_IMAGE_ACCEPTED_TYPES.includes(type) ? null : PRODUCT_IMAGE_TYPE_ERROR;
  }
  // Some platforms report an empty MIME type; fall back to the extension.
  const name = (file.name ?? '').trim().toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')) return null;
  return PRODUCT_IMAGE_TYPE_ERROR;
}

/** DELETE /api/v1/dashboard/products/:product_id/image */
export function buildProductImageDeletePath(productId: string): string {
  return `/api/v1/dashboard/products/${encodeURIComponent(productId)}/image`;
}

/**
 * Resolve a stored product image reference to a renderable URL.
 * - Absolute HTTP(S) URLs (external CDN images) render as-is.
 * - `blob:`/`data:` URLs (local upload previews) render as-is.
 * - Absolute paths such as `/api/v1/product-images/...` resolve against
 *   the configured API origin. Never hardcodes a host or port.
 * - Anything else (missing, blank, unparseable) returns null so callers
 *   render the empty-state placeholder.
 */
export function resolveProductImageUrl(
  value: string | null | undefined,
  origin?: string,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return trimmed;
    return null;
  } catch {
    // Not absolute — may be a backend-local reference below.
  }
  if (trimmed.startsWith('/')) {
    if (/\s/.test(trimmed)) return null;
    const base = (origin ?? '').replace(/\/+$/, '');
    return base ? `${base}${trimmed}` : trimmed;
  }
  return null;
}

/** Only OWNER and ADMIN may upload or remove product images. */
export function canManageProductImages(
  role: DashboardRole | string | null | undefined,
): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Upload a validated image file. Sends multipart/form-data with field name
 * `image` through the shared authenticated client (JWT handling unchanged)
 * and resolves with the returned `data.image_url` reference — never a local
 * blob URL. Rejects concurrent misuse by validating before sending.
 */
export async function uploadProductImage(file: Blob): Promise<string> {
  const validationError = validateProductImageFile({
    type: (file as Blob & { type?: string }).type,
    size: (file as Blob & { size?: number }).size,
    name: (file as File).name,
  });
  if (validationError) throw new Error(validationError);
  const form = new FormData();
  form.append('image', file);
  const response = await apiClient.post<ProductImageUploadResponse>(
    PRODUCT_IMAGE_UPLOAD_PATH,
    form,
    { retryOnUnauthorized: false },
  );
  const imageUrl = (response.data as Partial<ProductImageUploadResponse> | null | undefined)?.image_url;
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
    throw new Error('The image upload did not return an image reference. Please try again.');
  }
  return imageUrl.trim();
}

/**
 * Remove the persisted image of an already-saved product. Tolerates the
 * standard success envelope and empty responses; throws the shared
 * ApiClientError on failure so the UI can retain the existing image.
 * Never call this for a newly selected image that has not been saved to a
 * product — clearing the selection locally is enough there.
 */
export async function deleteProductImage(productId: string): Promise<void> {
  await apiClient.delete<unknown>(buildProductImageDeletePath(productId), {
    retryOnUnauthorized: false,
  });
}
