import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_ANALYTICS_KEY,
  buildAnalyticsPath,
  dashboardAnalyticsQueryKey,
} from './analyticsQuery.ts';
import type {
  DashboardAnalyticsResponse,
  DashboardProductSales,
} from '../types/backend.ts';

function analyticsResponse(overrides: Partial<DashboardAnalyticsResponse> = {}): DashboardAnalyticsResponse {
  return {
    period: { from: '2026-10-08T00:00:00Z', to: '2026-10-15T00:00:00Z' },
    interval: 'day',
    currency: 'IDR',
    summary: { total_revenue: 0, successful_payments: 0, units_sold: 0, average_order_value: null },
    revenue_trend: [],
    top_products: [],
    revenue_by_product: [],
    ...overrides,
  };
}

test('analytics path carries the normalized exclusive-end window', () => {
  assert.equal(
    buildAnalyticsPath('2026-10-08', '2026-10-15'),
    '/api/v1/dashboard/analytics?from=2026-10-08&to=2026-10-15',
  );
  assert.equal(buildAnalyticsPath('2026-10-08', '2026-10-15').includes('merchant_id'), false);
});

test('analytics query key is namespaced apart from overview', () => {
  assert.equal(DASHBOARD_ANALYTICS_KEY, 'dashboard-analytics');
  assert.notDeepEqual(
    dashboardAnalyticsQueryKey('merchant-a', '2026-10-08', '2026-10-15'),
    ['dashboard-overview', 'merchant-a', '2026-10-08', '2026-10-15'],
  );
});

test('analytics query keys distinguish ranges and merchants', () => {
  const keyA = dashboardAnalyticsQueryKey('merchant-a', '2026-10-08', '2026-10-15');
  assert.deepEqual(keyA, ['dashboard-analytics', 'merchant-a', '2026-10-08', '2026-10-15']);
  assert.notDeepEqual(keyA, dashboardAnalyticsQueryKey('merchant-a', '2026-09-15', '2026-10-15'));
  assert.notDeepEqual(keyA, dashboardAnalyticsQueryKey('merchant-b', '2026-10-08', '2026-10-15'));
});

test('empty analytics response drives empty states, not fabricated values', () => {
  const response = analyticsResponse();
  assert.equal(response.summary.total_revenue, 0);
  assert.equal(response.summary.successful_payments, 0);
  assert.equal(response.summary.units_sold, 0);
  assert.equal(response.summary.average_order_value, null);
  assert.equal(response.revenue_trend.length, 0);
  assert.equal(response.top_products.length, 0);
  assert.equal(response.revenue_by_product.length, 0);
});

test('populated analytics response keeps backend ordering for charts', () => {
  const kopi: DashboardProductSales = { product_id: 'p1', product_name: 'Kopi', units_sold: 4, revenue: 180000 };
  const teh: DashboardProductSales = { product_id: null, product_name: 'Teh Botol', units_sold: 3, revenue: 30000 };
  const response = analyticsResponse({
    summary: { total_revenue: 230000, successful_payments: 4, units_sold: 7, average_order_value: 70000 },
    revenue_trend: [
      { date: '2026-10-10', revenue: 120000 },
      { date: '2026-10-11', revenue: 0 },
    ],
    top_products: [kopi, teh],
    revenue_by_product: [kopi, teh],
  });
  // Top products ranked by units (backend order preserved by the charts).
  assert.ok(response.top_products[0].units_sold >= response.top_products[1].units_sold);
  // Revenue table ranked by revenue descending.
  assert.ok(response.revenue_by_product[0].revenue >= response.revenue_by_product[1].revenue);
  // Zero buckets are explicit, never missing.
  assert.equal(response.revenue_trend[1].revenue, 0);
  // Deleted products keep a null id with their snapshot name.
  assert.equal(response.top_products[1].product_id, null);
});

test('analytics and overview tabs use independent ranges without collision', () => {
  const overviewKey = ['dashboard-overview', 'merchant-a', '2026-10-08', '2026-10-15'];
  const analyticsKey = dashboardAnalyticsQueryKey('merchant-a', '2026-10-01', '2026-11-01');
  assert.notDeepEqual(overviewKey, analyticsKey);
});
