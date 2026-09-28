// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
  error?: ApiError;
}

export interface ApiMeta {
  request_id?: string;
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
  /** Legacy nested shape; current backend uses the flat fields above. */
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit?: number;
  page_size?: number;
  total: number;
  total_pages: number;
}

export type ApiErrorDetails = Record<string, string | string[]>;

export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetails;
}

export function listTotalPages(meta?: ApiMeta | null): number {
  if (!meta) return 1;
  if (typeof meta.total_pages === 'number') return meta.total_pages;
  if (typeof meta.pagination?.total_pages === 'number') return meta.pagination.total_pages;
  return 1;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PaymentStatus = 'CREATED' | 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type ReconciliationStatus = 'RECONCILED' | 'MISMATCH';
export type WebhookStatus = 'DELIVERED' | 'FAILED' | 'PENDING' | 'RETRYING';
export type ID = string;

export interface Timestamps {
  created_at: string;
  updated_at: string;
}
