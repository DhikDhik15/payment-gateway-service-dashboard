import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_IMAGE_MAX_SIZE_BYTES,
  PRODUCT_IMAGE_UPLOAD_PATH,
  buildProductImageDeletePath,
  canManageProductImages,
  deleteProductImage,
  resolveProductImageUrl,
  uploadProductImage,
  validateProductImageFile,
} from './productImages.ts';
import { ApiClientError } from '../api/client.ts';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('client-side size ceiling is 5 MiB', () => {
  assert.equal(PRODUCT_IMAGE_MAX_SIZE_BYTES, 5 * 1024 * 1024);
});

test('validateProductImageFile accepts JPEG and PNG', () => {
  assert.equal(validateProductImageFile({ type: 'image/jpeg', size: 1024, name: 'a.jpg' }), null);
  assert.equal(validateProductImageFile({ type: 'image/png', size: 1024, name: 'a.png' }), null);
  assert.equal(
    validateProductImageFile({ type: 'image/jpeg', size: PRODUCT_IMAGE_MAX_SIZE_BYTES, name: 'a.jpg' }),
    null,
  );
});

test('validateProductImageFile rejects unsupported types', () => {
  assert.equal(
    validateProductImageFile({ type: 'image/gif', size: 100, name: 'a.gif' }),
    'Only JPG and PNG images are supported.',
  );
  assert.equal(
    validateProductImageFile({ type: 'image/webp', size: 100, name: 'a.webp' }),
    'Only JPG and PNG images are supported.',
  );
  assert.equal(
    validateProductImageFile({ type: 'text/plain', size: 100, name: 'a.txt' }),
    'Only JPG and PNG images are supported.',
  );
});

test('validateProductImageFile rejects oversized files', () => {
  assert.equal(
    validateProductImageFile({
      type: 'image/png',
      size: PRODUCT_IMAGE_MAX_SIZE_BYTES + 1,
      name: 'big.png',
    }),
    'Image must be 5 MB or smaller.',
  );
});

test('upload uses multipart/form-data with field name "image" and no JSON Content-Type', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });
    return jsonResponse({ success: true, data: { image_url: '/api/v1/product-images/abc.png' } });
  }) as typeof fetch;

  const file = new Blob(['fake-png-bytes'], { type: 'image/png' });
  const imageUrl = await uploadProductImage(file);

  assert.equal(imageUrl, '/api/v1/product-images/abc.png');
  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.url.endsWith(PRODUCT_IMAGE_UPLOAD_PATH), calls[0]?.url);
  const body = calls[0]?.init?.body;
  assert.ok(body instanceof FormData, 'upload body must be FormData');
  assert.ok(body.get('image') instanceof Blob, 'multipart field name must be "image"');
  const contentType = new Headers(calls[0]?.init?.headers).get('content-type');
  assert.equal(contentType, null);
});

test('upload returns the backend data.image_url reference', async () => {
  globalThis.fetch = (async () =>
    jsonResponse({ success: true, data: { image_url: '  /api/v1/product-images/xyz.jpg  ' } })) as typeof fetch;
  const imageUrl = await uploadProductImage(new Blob(['x'], { type: 'image/jpeg' }));
  assert.equal(imageUrl, '/api/v1/product-images/xyz.jpg');
});

test('upload rejects invalid files before any network request', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ success: true, data: { image_url: '/x' } });
  }) as typeof fetch;
  await assert.rejects(
    () => uploadProductImage(new Blob(['x'], { type: 'image/gif' })),
    /Only JPG and PNG/,
  );
  assert.equal(calls, 0);
});

test('upload failure surfaces an error for the UI', async () => {
  globalThis.fetch = (async () =>
    jsonResponse(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'bad image' } },
      422,
    )) as typeof fetch;
  await assert.rejects(
    () => uploadProductImage(new Blob(['x'], { type: 'image/png' })),
    (error: unknown) => error instanceof ApiClientError && error.status === 422,
  );
});

test('upload without an image_url in the response is rejected', async () => {
  globalThis.fetch = (async () =>
    jsonResponse({ success: true, data: {} })) as typeof fetch;
  await assert.rejects(
    () => uploadProductImage(new Blob(['x'], { type: 'image/png' })),
    /image reference/,
  );
});

test('removing a persisted image uses DELETE /api/v1/dashboard/products/:id/image', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });
    return jsonResponse({ success: true, data: {} });
  }) as typeof fetch;

  assert.equal(buildProductImageDeletePath('prod 1/a'), '/api/v1/dashboard/products/prod%201%2Fa/image');
  await deleteProductImage('prod-123');
  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.url.endsWith('/api/v1/dashboard/products/prod-123/image'), calls[0]?.url);
  assert.equal(calls[0]?.init?.method, 'DELETE');
});

test('image removal failure leaves the error to the caller so the image is retained', async () => {
  globalThis.fetch = (async () =>
    jsonResponse({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'gone' } }, 404)) as typeof fetch;
  const currentImage = '/api/v1/product-images/keep.png';
  await assert.rejects(() => deleteProductImage('missing'));
  assert.equal(currentImage, '/api/v1/product-images/keep.png');
});

test('resolveProductImageUrl renders external HTTPS URLs as-is', () => {
  assert.equal(
    resolveProductImageUrl('https://cdn.example.com/a.png?x=1', 'http://localhost:8081'),
    'https://cdn.example.com/a.png?x=1',
  );
});

test('resolveProductImageUrl resolves local references against the API origin', () => {
  assert.equal(
    resolveProductImageUrl('/api/v1/product-images/abc.png', 'http://localhost:8081'),
    'http://localhost:8081/api/v1/product-images/abc.png',
  );
  assert.equal(
    resolveProductImageUrl('/api/v1/product-images/abc.png', 'https://api.example.com/'),
    'https://api.example.com/api/v1/product-images/abc.png',
  );
  // Never hardcodes a development host.
  const resolved = resolveProductImageUrl('/api/v1/product-images/abc.png', 'https://api.example.com');
  assert.ok(!resolved?.includes('localhost') && !resolved?.includes('8081'), resolved ?? '');
});

test('resolveProductImageUrl returns null for missing images', () => {
  assert.equal(resolveProductImageUrl(null, 'http://localhost:8081'), null);
  assert.equal(resolveProductImageUrl(undefined, 'http://localhost:8081'), null);
  assert.equal(resolveProductImageUrl('', 'http://localhost:8081'), null);
  assert.equal(resolveProductImageUrl('   ', 'http://localhost:8081'), null);
  assert.equal(resolveProductImageUrl('images/a.png', 'http://localhost:8081'), null);
});

test('resolveProductImageUrl keeps local previews renderable', () => {
  assert.equal(resolveProductImageUrl('blob:http://localhost/abc', 'http://localhost:8081'), 'blob:http://localhost/abc');
});

test('only OWNER and ADMIN may upload or remove images', () => {
  assert.equal(canManageProductImages('OWNER'), true);
  assert.equal(canManageProductImages('ADMIN'), true);
  assert.equal(canManageProductImages('VIEWER'), false);
  assert.equal(canManageProductImages(null), false);
  assert.equal(canManageProductImages(undefined), false);
  assert.equal(canManageProductImages(''), false);
});
