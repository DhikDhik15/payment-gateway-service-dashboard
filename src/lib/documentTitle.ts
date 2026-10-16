import { useEffect } from 'react';

/** Product name used in document titles. Matches index.html. */
export const APP_NAME = 'PayGate Merchant Dashboard';

/**
 * Single route → title map for header labels and document titles.
 * Exact matches win; `:id` detail routes fall through to prefix rules.
 * Unknown paths resolve to 'Page not found' instead of a stale label.
 */
export function getRouteTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/login': 'Sign in',
    '/forgot-password': 'Forgot password',
    '/reset-password': 'Reset password',
    '/accept-invitation': 'Accept invitation',
    '/dashboard': 'Overview',
    '/dashboard/payments': 'Payments',
    '/dashboard/payments/new': 'Create payment',
    '/dashboard/products': 'Products',
    '/dashboard/categories': 'Categories',
    '/dashboard/refunds': 'Refunds',
    '/dashboard/webhooks': 'Webhooks',
    '/dashboard/settlements': 'Settlements',
    '/dashboard/reconciliation': 'Reconciliation',
    '/dashboard/api-keys': 'API Keys',
    '/dashboard/webhook-config': 'Webhook Config',
    '/dashboard/settings': 'Settings',
    '/dashboard/team': 'Team',
    '/simulator': 'Payment simulator',
    '/client-simulator': 'Client simulator',
  };
  if (map[pathname]) return map[pathname];
  if (pathname.startsWith('/dashboard/payments/')) return 'Payment Detail';
  if (pathname.startsWith('/dashboard/refunds/')) return 'Refund Detail';
  if (pathname.startsWith('/dashboard/webhooks/')) return 'Webhook Delivery';
  if (pathname.startsWith('/dashboard/reconciliation/')) return 'Reconciliation Detail';
  if (pathname.startsWith('/checkout/')) return 'Checkout simulator';
  if (pathname.startsWith('/pay/')) return 'Complete payment';
  return 'Page not found';
}

export function formatDocumentTitle(routeTitle: string): string {
  return `${routeTitle} · ${APP_NAME}`;
}

/** Sets `document.title` for the current route. No-op during SSR. */
export function useDocumentTitle(routeTitle: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = formatDocumentTitle(routeTitle);
  }, [routeTitle]);
}
