import test from 'node:test';
import assert from 'node:assert/strict';
import { listTotalPages, type ApiMeta } from './common.ts';

test('listTotalPages reads flat backend meta.total_pages', () => {
  const meta: ApiMeta = { page: 1, limit: 10, total: 15, total_pages: 2 };
  assert.equal(listTotalPages(meta), 2);
});

test('listTotalPages falls back to nested pagination', () => {
  const meta: ApiMeta = {
    pagination: { page: 1, page_size: 10, total: 5, total_pages: 3 },
  };
  assert.equal(listTotalPages(meta), 3);
});

test('listTotalPages defaults to 1 when meta missing', () => {
  assert.equal(listTotalPages(undefined), 1);
  assert.equal(listTotalPages(null), 1);
  assert.equal(listTotalPages({}), 1);
});

test('listTotalPages prefers flat over nested', () => {
  const meta: ApiMeta = {
    total_pages: 4,
    pagination: { page: 1, total: 1, total_pages: 9 },
  };
  assert.equal(listTotalPages(meta), 4);
});
