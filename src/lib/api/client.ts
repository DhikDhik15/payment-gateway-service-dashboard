// ─── API Client ───────────────────────────────────────────────────────────────
//
// All dashboard network traffic goes through this module. Authenticated calls
// use the short-lived Bearer access token from memory; the browser-managed
// HttpOnly refresh cookie is sent with credentials: "include". Public token
// and mock-payment flows explicitly opt out of both dashboard auth and cookie credentials.

import type { ApiErrorDetails, ApiResponse } from '@/types/common';

const runtimeEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | boolean | undefined>;
}).env ?? {};
const configuredBaseUrl = typeof runtimeEnv.VITE_API_BASE_URL === 'string'
  ? runtimeEnv.VITE_API_BASE_URL
  : undefined;
if (runtimeEnv.PROD === true && !configuredBaseUrl) {
  throw new Error('VITE_API_BASE_URL must be configured for a production dashboard build.');
}
if (runtimeEnv.PROD === true && configuredBaseUrl) {
  const parsedBaseUrl = new URL(configuredBaseUrl);
  const localHost = parsedBaseUrl.hostname === 'localhost' || parsedBaseUrl.hostname === '127.0.0.1' || parsedBaseUrl.hostname === '[::1]';
  if (parsedBaseUrl.protocol !== 'https:' && !localHost) {
    throw new Error('Production dashboard API URLs must use HTTPS.');
  }
}
const BASE_URL = (configuredBaseUrl || '').replace(/\/+$/, '');

export type RefreshTokenHandler = () => Promise<string | null>;
export type TokenGetter = () => string | null;
export type SessionExpiredHandler = (reason?: 'expired' | 'merchant_inactive' | 'user_disabled') => void;

let refreshHandler: RefreshTokenHandler | null = null;
let tokenGetter: TokenGetter | null = null;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setApiClientRefreshHandler(handler: RefreshTokenHandler | null): void {
  refreshHandler = handler;
}

export function setApiClientTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export function setApiClientSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

export class ApiClientError extends Error {
  public readonly details?: ApiErrorDetails;
  public readonly retryAfterSeconds?: number;

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    details?: ApiErrorDetails,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RequestOptions {
  /** Optional explicit Bearer token. The normal path uses the memory token getter. */
  token?: string;
  /** Development-only simulator credential. Never use this for dashboard calls. */
  apiKey?: string;
  /** Do not attach the dashboard Bearer token (public token-flow endpoints). */
  skipAuth?: boolean;
  /** Do not attempt dashboard refresh or session-expiry handling. */
  skipRefresh?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  /**
   * Retrying a mutation after a 401 is unsafe by default. A caller may opt in
   * only when its operation has a backend idempotency guarantee.
   */
  retryOnUnauthorized?: boolean;
  /** Request timeout in milliseconds. Set to 0 to disable. */
  timeoutMs?: number;
  /** Internal retry marker; do not set in feature code. */
  retry?: boolean;
}

const statusMessages: Record<number, string> = {
  400: 'Please check the information you entered and try again.',
  401: 'Your session is no longer valid. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found or is no longer available.',
  409: 'This action conflicts with the current resource state.',
  422: 'Please correct the highlighted fields and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again later.',
  502: 'The payment provider returned an invalid response. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
  504: 'The payment provider took too long to respond. Please try again later.',
};

const safeCodeMessages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  USER_DISABLED: 'This account has been disabled.',
  MERCHANT_INACTIVE: 'This merchant is not active.',
  INSUFFICIENT_ROLE: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  INVALID_REQUEST: 'The request could not be completed.',
  INVALID_CURRENCY: 'The selected currency is not supported.',
  INVALID_PAYMENT_METHOD: 'The selected payment method is not supported.',
  DUPLICATE_ORDER: 'A payment with this merchant order ID already exists.',
  IDEMPOTENCY_KEY_REUSED: 'This idempotency key was already used with different payment details.',
  IDEMPOTENCY_REQUEST_IN_PROGRESS: 'This operation is already in progress. Please wait before retrying.',
  IDEMPOTENCY_IN_PROGRESS: 'This operation is already in progress. Please wait before retrying.',
  TRANSACTION_NOT_FOUND: 'The payment was not found.',
  REFUND_NOT_FOUND: 'The refund was not found.',
  REFUND_TRANSACTION_NOT_PAID: 'Refunds are only available for paid payments.',
  REFUND_AMOUNT_EXCEEDED: 'The refund amount exceeds the available refundable balance.',
  REFUND_CURRENCY_MISMATCH: 'The refund currency must match the payment currency.',
  WEBHOOK_DESTINATION_BLOCKED: 'The webhook destination is not allowed.',
  LAST_OWNER_REQUIRED: 'The merchant must keep at least one active OWNER.',
  INVALID_CURRENT_PASSWORD: 'The current password is incorrect.',
  INVALID_PASSWORD: 'The password does not meet the password policy.',
  INVALID_ROLE: 'Select a valid team role.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  INVITATION_ALREADY_PENDING: 'An invitation is already pending for this email.',
  INVITATION_ALREADY_ACCEPTED: 'This invitation has already been accepted.',
  INVITATION_NOT_FOUND: 'This invitation is no longer available.',
  API_KEY_ALREADY_REVOKED: 'This API key is already revoked.',
  RESOURCE_NOT_FOUND: 'The requested resource was not found.',
  DASHBOARD_USER_NOT_FOUND: 'The team member was not found.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait and try again.',
};

function publicMessage(status: number, fallback?: string, code?: string): string {
  // Never pass arbitrary response text to the UI. Only explicitly approved
  // stable backend codes are shown; field-level details are handled separately.
  if (status >= 500) return statusMessages[status] ?? 'The service is temporarily unavailable.';
  if (code && safeCodeMessages[code]) return safeCodeMessages[code];
  if (status === 422) return statusMessages[status];
  if (fallback && status < 400) return fallback.trim().slice(0, 500);
  return statusMessages[status] ?? 'The request could not be completed.';
}

function notifySessionExpired(reason: 'expired' | 'merchant_inactive' | 'user_disabled' = 'expired'): void {
  try {
    sessionExpiredHandler?.(reason);
  } catch {
    // A UI listener must never turn an authentication failure into a second
    // unhandled application error.
  }
}

function isAbortError(error: unknown): boolean {
  return typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError';
}

function requestSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal | undefined; cleanup: () => void; didTimeout: () => boolean } {
  if (!timeoutMs || (!callerSignal && !timeoutMs)) {
    return { signal: callerSignal, cleanup: () => undefined, didTimeout: () => false };
  }

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onAbort);
    },
    didTimeout: () => timedOut,
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get('Retry-After');
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const token = options.skipAuth ? null : options.token ?? tokenGetter?.();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.apiKey) headers['X-API-Key'] = options.apiKey;

  const timeout = requestSignal(options.signal, options.timeoutMs ?? 20_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timeout.signal,
      credentials: options.credentials ?? (options.skipAuth ? 'omit' : 'include'),
    });
  } catch (error) {
    if (timeout.didTimeout()) {
      throw new ApiClientError(0, 'REQUEST_TIMEOUT', 'The request timed out. Please try again.');
    }
    if (isAbortError(error)) throw error;
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.');
  } finally {
    timeout.cleanup();
  }

  let pendingSessionEndReason: 'expired' | 'merchant_inactive' | 'user_disabled' | undefined;
  const canRetry = !options.retry &&
    !options.skipRefresh &&
    response.status === 401 &&
    !path.startsWith('/api/v1/auth/') &&
    (method === 'GET' || options.retryOnUnauthorized === true);

  if (canRetry && refreshHandler && !options.signal?.aborted) {
    let nextToken: string | null = null;
    let refreshError: unknown;
    try {
      nextToken = await refreshHandler();
    } catch (error) {
      refreshError = error;
    }
    if (nextToken) {
      return request<T>(method, path, body, {
        ...options,
        token: nextToken,
        retry: true,
      });
    }
    // Only an actual 401 from refresh invalidates the session. A timeout,
    // network error, or provider 5xx should remain retryable by the user.
    if (refreshError instanceof ApiClientError && refreshError.status === 401) {
      pendingSessionEndReason = 'expired';
    } else if (!refreshError) {
      pendingSessionEndReason = 'expired';
    }
  } else if (!options.skipRefresh && response.status === 401 && !path.startsWith('/api/v1/auth/') && token) {
    // No usable refresh path (or refresh failed): make the session transition
    // explicit instead of leaving an authenticated-looking broken UI.
    pendingSessionEndReason = 'expired';
  }

  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const json = await readResponseBody(response);
  const validEnvelope = response.status === 204 || (
    typeof json === 'object' && json !== null &&
    typeof (json as { success?: unknown }).success === 'boolean'
  );
  if (!validEnvelope) {
    if (pendingSessionEndReason) notifySessionExpired(pendingSessionEndReason);
    throw new ApiClientError(
      response.status,
      'INVALID_RESPONSE',
      publicMessage(response.status, 'The server returned an invalid response. Please try again.'),
      requestId,
    );
  }
  const envelope = (json ?? {}) as Partial<ApiResponse<T>>;
  const error = envelope.error;

  if (!response.ok || envelope.success === false) {
    const status = response.status;
    const code = error?.code ?? (status === 401 ? 'UNAUTHORIZED' : 'REQUEST_FAILED');
    const details = error?.details;
    if (pendingSessionEndReason) {
      notifySessionExpired(
        code === 'MERCHANT_INACTIVE'
          ? 'merchant_inactive'
          : code === 'USER_DISABLED'
            ? 'user_disabled'
            : pendingSessionEndReason,
      );
    }
    throw new ApiClientError(
      status,
      code,
      publicMessage(status, error?.message, code),
      requestId,
      details,
      retryAfterSeconds(response),
    );
  }

  // A few backend success responses contain an empty object. Returning a typed
  // envelope here keeps feature hooks uniform without inventing response data.
  return {
    success: true,
    data: envelope.data as T,
    meta: envelope.meta,
  };
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('GET', path, undefined, options);
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('POST', path, body, options);
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('PUT', path, body, options);
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('PATCH', path, body, options);
  },
  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('DELETE', path, undefined, options);
  },
};

/**
 * Request options for customer-facing provider routes.
 *
 * These routes intentionally have no dashboard identity. Keep the security
 * flags out of feature code so a public payment request cannot accidentally
 * inherit the in-memory dashboard bearer token or refresh cookie.
 */
export type PublicRequestOptions = Omit<
  RequestOptions,
  'apiKey' | 'token' | 'skipAuth' | 'skipRefresh' | 'credentials' | 'retryOnUnauthorized'
>;

function publicRequestOptions(options?: PublicRequestOptions): RequestOptions {
  const supplied = (options ?? {}) as RequestOptions;
  const headers = { ...(supplied.headers ?? {}) };
  for (const name of Object.keys(headers)) {
    const normalized = name.toLowerCase();
    if (normalized === 'authorization' || normalized === 'x-api-key') delete headers[name];
  }
  return {
    signal: supplied.signal,
    headers,
    timeoutMs: supplied.timeoutMs,
    skipAuth: true,
    skipRefresh: true,
    credentials: 'omit',
    retryOnUnauthorized: false,
  };
}

/** Unauthenticated client for the persisted development payment provider. */
export const publicApiClient = {
  get<T>(path: string, options?: PublicRequestOptions): Promise<ApiResponse<T>> {
    return apiClient.get<T>(path, publicRequestOptions(options));
  },
  post<T>(path: string, body?: unknown, options?: PublicRequestOptions): Promise<ApiResponse<T>> {
    return apiClient.post<T>(path, body, publicRequestOptions(options));
  },
};

export function apiBaseUrl(): string {
  return BASE_URL;
}
