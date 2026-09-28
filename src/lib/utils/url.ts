/** Return an absolute HTTP(S) URL suitable for an external link, or null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Open a backend-provided payment URL without reconstructing or changing it.
 * Returns false when the value is missing or not an absolute HTTP(S) URL.
 */
export function openPaymentPage(value: string | null | undefined): boolean {
  if (typeof value !== 'string' || !safeHttpUrl(value) || typeof window === 'undefined') return false;
  window.open(value, '_blank', 'noopener,noreferrer');
  return true;
}
