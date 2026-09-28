import { ApiClientError } from './client';
import type { ApiErrorDetails } from '@/types/common';

/** Safe, user-facing error text for common dashboard responses. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiClientError) return error.message || fallback;
  if (error instanceof TypeError) return 'Unable to reach the server. Check your connection and try again.';
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function errorDetails(error: unknown): ApiErrorDetails | undefined {
  return error instanceof ApiClientError ? error.details : undefined;
}

export function fieldError(error: unknown, field: string): string | undefined {
  const value = errorDetails(error)?.[field];
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'string') return undefined;
  return first.split('').filter((character) => character.charCodeAt(0) >= 32).join('').slice(0, 300);
}

export function isStatus(error: unknown, status: number): boolean {
  return error instanceof ApiClientError && error.status === status;
}

export function isErrorCode(error: unknown, ...codes: string[]): boolean {
  return error instanceof ApiClientError && codes.includes(error.code);
}

export function isLastOwnerError(error: unknown): boolean {
  return isErrorCode(error, 'LAST_OWNER_REQUIRED');
}

export function isMerchantInactiveError(error: unknown): boolean {
  return isErrorCode(error, 'MERCHANT_INACTIVE');
}

export function isRateLimited(error: unknown): boolean {
  return isStatus(error, 429);
}

export function retryAfterLabel(error: unknown): string | undefined {
  if (!(error instanceof ApiClientError) || error.retryAfterSeconds === undefined) return undefined;
  return `${error.retryAfterSeconds}s`;
}
