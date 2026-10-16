import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_NAME, formatDocumentTitle, getRouteTitle } from './documentTitle.ts';

test('route titles cover every dashboard route label', () => {
  assert.equal(getRouteTitle('/dashboard'), 'Overview');
  assert.equal(getRouteTitle('/dashboard/payments'), 'Payments');
  assert.equal(getRouteTitle('/dashboard/products'), 'Products');
  assert.equal(getRouteTitle('/dashboard/categories'), 'Categories');
  assert.equal(getRouteTitle('/dashboard/refunds'), 'Refunds');
  assert.equal(getRouteTitle('/dashboard/webhooks'), 'Webhooks');
  assert.equal(getRouteTitle('/dashboard/settlements'), 'Settlements');
  assert.equal(getRouteTitle('/dashboard/reconciliation'), 'Reconciliation');
  assert.equal(getRouteTitle('/dashboard/api-keys'), 'API Keys');
  assert.equal(getRouteTitle('/dashboard/webhook-config'), 'Webhook Config');
  assert.equal(getRouteTitle('/dashboard/settings'), 'Settings');
  assert.equal(getRouteTitle('/dashboard/team'), 'Team');
});

test('payment creation route has its own title instead of the detail label', () => {
  assert.equal(getRouteTitle('/dashboard/payments/new'), 'Create payment');
  assert.equal(getRouteTitle('/dashboard/payments/txn_123'), 'Payment Detail');
});

test('detail routes resolve by prefix and unknown routes resolve to not-found', () => {
  assert.equal(getRouteTitle('/dashboard/refunds/rf_1'), 'Refund Detail');
  assert.equal(getRouteTitle('/dashboard/webhooks/dlv_1'), 'Webhook Delivery');
  assert.equal(getRouteTitle('/dashboard/reconciliation/m_1'), 'Reconciliation Detail');
  assert.equal(getRouteTitle('/login'), 'Sign in');
  assert.equal(getRouteTitle('/forgot-password'), 'Forgot password');
  assert.equal(getRouteTitle('/reset-password'), 'Reset password');
  assert.equal(getRouteTitle('/accept-invitation'), 'Accept invitation');
  assert.equal(getRouteTitle('/simulator'), 'Payment simulator');
  assert.equal(getRouteTitle('/no-such-page'), 'Page not found');
  assert.equal(getRouteTitle('/dashboard/no-such-page'), 'Page not found');
});

test('document titles use the application name', () => {
  assert.equal(APP_NAME, 'PayGate Merchant Dashboard');
  assert.equal(formatDocumentTitle('Payments'), 'Payments · PayGate Merchant Dashboard');
  assert.equal(formatDocumentTitle('Page not found'), 'Page not found · PayGate Merchant Dashboard');
});
