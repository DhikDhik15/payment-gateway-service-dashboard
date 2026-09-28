import type { MockPaymentResponse, MockPaymentStatus } from '@/types';

const MOCK_PAYMENT_STATUSES: readonly MockPaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
];

export function buildMockPaymentPath(identifier: string): string {
  if (!identifier) throw new Error('A mock payment identifier is required.');
  return `/api/v1/mock-payments/${encodeURIComponent(identifier)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidExpiry(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** Validate the public provider DTO before it reaches the payment UI. */
export function isMockPaymentResponse(value: unknown): value is MockPaymentResponse {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.reference)) return false;
  if (typeof value.amount !== 'number' || !Number.isSafeInteger(value.amount) || value.amount <= 0) return false;
  if (typeof value.currency !== 'string' || !/^[A-Za-z]{3}$/.test(value.currency)) return false;
  if (!isNonEmptyString(value.payment_method)) return false;
  if (typeof value.status !== 'string' || !MOCK_PAYMENT_STATUSES.includes(value.status as MockPaymentStatus)) return false;
  if (!isValidExpiry(value.expired_at)) return false;
  if (!isNonEmptyString(value.provider_transaction_id)) return false;
  if (value.qris_payload !== undefined && value.qris_payload !== null && typeof value.qris_payload !== 'string') return false;
  return true;
}

/**
 * The mock provider can still report PENDING briefly after its expiry
 * timestamp. Treat that timestamp as an effective terminal state for the
 * customer UI, while retaining the backend status in the cached DTO.
 */
export function isMockPaymentPastExpiry(
  payment: Pick<MockPaymentResponse, 'status' | 'expired_at'>,
  now = Date.now(),
): boolean {
  if (payment.status !== 'PENDING') return false;
  const expiry = Date.parse(payment.expired_at);
  return Number.isFinite(expiry) && expiry <= now;
}

export function effectiveMockPaymentStatus(
  payment: Pick<MockPaymentResponse, 'status' | 'expired_at'>,
  now = Date.now(),
): MockPaymentStatus {
  return isMockPaymentPastExpiry(payment, now) ? 'EXPIRED' : payment.status;
}

export function mockPaymentRefetchInterval(
  payment: Pick<MockPaymentResponse, 'status' | 'expired_at'> | undefined,
  now = Date.now(),
): number | false {
  if (!payment || payment.status !== 'PENDING' || isMockPaymentPastExpiry(payment, now)) return false;
  return 3_000;
}
