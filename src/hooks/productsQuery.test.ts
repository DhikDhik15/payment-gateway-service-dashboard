import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductsListPath,
  buildProductDetailPath,
  buildCategoriesListPath,
  buildCategoryDetailPath,
  dashboardProductsQueryKey,
  dashboardCategoriesQueryKey,
} from './productsQuery.ts';

test('buildProductsListPath sends pagination and filters', () => {
  const path = buildProductsListPath({
    page: 2,
    limit: 5,
    category_id: 'cat-1',
    active: true,
    search: 'cof',
  });
  assert.ok(path.startsWith('/api/v1/dashboard/products?'));
  const query = new URLSearchParams(path.split('?')[1]);
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('limit'), '5');
  assert.equal(query.get('category_id'), 'cat-1');
  assert.equal(query.get('active'), 'true');
  assert.equal(query.get('search'), 'cof');
});

test('buildProductsListPath omits absent and blank filters', () => {
  const path = buildProductsListPath({ page: 1, limit: 20, search: '   ' });
  const query = new URLSearchParams(path.split('?')[1]);
  assert.equal(query.get('page'), '1');
  assert.equal(query.get('limit'), '20');
  assert.ok(!query.has('status'));
  assert.ok(!query.has('search'));
  assert.ok(!query.has('category_id'));
  assert.ok(!query.has('active'));
});

test('buildProductsListPath trims search text', () => {
  const path = buildProductsListPath({ search: '  Arabica  ' });
  assert.ok(path.includes('search=Arabica'), path);
});

test('buildProductsListPath rejects unexpected filters', () => {
  assert.throws(
    () => buildProductsListPath({ merchant_id: 'm-1' } as never),
    /Unsupported product list filter/,
  );
});

test('buildProductsListPath never includes merchant_id', () => {
  const path = buildProductsListPath({ page: 1, limit: 20 });
  assert.ok(!path.includes('merchant_id'), path);
});

test('detail paths encode identifiers', () => {
  assert.equal(
    buildProductDetailPath('a/b?c'),
    '/api/v1/dashboard/products/a%2Fb%3Fc',
  );
  assert.equal(
    buildCategoryDetailPath('cat 1'),
    '/api/v1/dashboard/categories/cat%201',
  );
  assert.equal(buildCategoriesListPath(), '/api/v1/dashboard/categories');
});

test('query keys isolate merchants in the cache key', () => {
  const keyA = dashboardProductsQueryKey('merchant-a', { page: 1 });
  const keyB = dashboardProductsQueryKey('merchant-b', { page: 1 });
  assert.deepEqual(keyA[0], 'dashboard-products');
  assert.notDeepEqual(keyA, keyB);
  assert.deepEqual(dashboardCategoriesQueryKey('m'), ['dashboard-categories', 'm']);
});
