/**
 * Simulator QR helpers — visual QR for Checkout Simulator only.
 * Payload is deliberately non-QRIS and contains no secrets.
 */

export const SIMULATOR_QR_SCHEME = 'pay-simulator';

/** Build a deterministic simulator QR payload for a payment. */
export function buildSimulatorQrPayload(paymentId: string): string {
  const id = paymentId.trim();
  if (!id) {
    throw new Error('paymentId is required for simulator QR payload');
  }
  return `${SIMULATOR_QR_SCHEME}://payment/${id}`;
}

/** True when the payment method should show the QRIS simulation QR. */
export function isQrisPaymentMethod(paymentMethod: string | null | undefined): boolean {
  return (paymentMethod ?? '').trim().toUpperCase() === 'QRIS';
}

/** Reject payloads that look like secrets or production QRIS EMV. */
export function isSafeSimulatorQrPayload(payload: string, paymentId: string): boolean {
  if (!payload.includes(paymentId)) return false;
  if (!payload.startsWith(`${SIMULATOR_QR_SCHEME}://payment/`)) return false;

  const forbidden = [
    'secret',
    'api_key',
    'apikey',
    'midtrans',
    'server_key',
    'webhook',
    'password',
    'bearer',
  ];
  const lower = payload.toLowerCase();
  if (forbidden.some((token) => lower.includes(token))) return false;

  // Production QRIS EMVCo payloads typically start with "000201"
  if (payload.startsWith('000201')) return false;

  return true;
}
