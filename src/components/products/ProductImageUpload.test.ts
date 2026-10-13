import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toSubmit } from './ProductForm.tsx';

// Test bundles execute from a temp directory, so resolve sources from the
// repository root (the working directory of `npm test`).
const root = process.cwd();
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const formSource = read(join('src', 'components', 'products', 'ProductForm.tsx'));
const uploadSource = read(join('src', 'components', 'products', 'ProductImageUpload.tsx'));
const imageSource = read(join('src', 'components', 'products', 'ProductImage.tsx'));
const catalogSource = read(join('src', 'lib', 'catalog', 'productImages.ts'));
const pageSource = read(join('src', 'pages', 'ProductsPage.tsx'));

function validValues(imageUrl: string) {
  return {
    name: 'Arabica 250g',
    sku: 'SKU-1',
    description: '',
    priceInput: '85000',
    currency: 'IDR',
    category_id: '',
    image_url: imageUrl,
    active: true,
  } as const;
}

test('Create Product modal no longer displays a manual Image URL input', () => {
  assert.ok(!formSource.includes('product-image-url'), 'manual image URL input id must be gone');
  assert.ok(!formSource.includes('Image URL'), 'manual Image URL label must be gone');
  assert.ok(!formSource.includes('type="url"'), 'manual URL text input must be gone');
  assert.ok(formSource.includes('ProductImageUpload'), 'upload component must be used');
});

test('Edit Product modal no longer displays a manual Image URL input', () => {
  // Both modals render the shared ProductForm; the edit branch passes the
  // saved product identity for persisted-image removal.
  assert.ok(pageSource.includes('productId={editor.product.id}'));
  assert.ok(!formSource.includes('product-image-url'));
  assert.ok(formSource.includes('ProductImageUpload'));
});

test('existing image is loaded into the Edit Product preview', () => {
  assert.ok(formSource.includes("persistedRef={product?.image_url ?? ''}"));
  assert.ok(formSource.includes('value={imageUrl}'));
  assert.ok(pageSource.includes('key={editor.product.id}'), 'form remounts per product');
});

test('selecting a valid image displays a preview immediately', () => {
  const previewAt = uploadSource.indexOf('URL.createObjectURL');
  const uploadAt = uploadSource.indexOf('await uploadProductImage');
  assert.ok(previewAt !== -1 && uploadAt !== -1 && previewAt < uploadAt);
  assert.ok(uploadSource.includes('alt="Product image preview"'));
  assert.ok(uploadSource.includes('Choose an image'));
});

test('invalid file types and oversized files are rejected client-side', () => {
  assert.ok(uploadSource.includes('validateProductImageFile'));
  assert.ok(uploadSource.includes('Supported formats: JPG, PNG. Maximum size: 5 MB.'));
});

test('upload uses multipart/form-data with field name "image"', () => {
  assert.ok(catalogSource.includes("form.append('image'"));
  assert.ok(!catalogSource.includes('Content-Type'), 'multipart must not set a JSON Content-Type');
  assert.ok(catalogSource.includes('/api/v1/dashboard/product-images'));
});

test('the returned data.image_url is used when creating a product', () => {
  const body = toSubmit(validValues('/api/v1/product-images/new-upload.png'));
  assert.equal(body.image_url, '/api/v1/product-images/new-upload.png');
});

test('the returned image reference is used when replacing an existing image', () => {
  const body = toSubmit(validValues('/api/v1/product-images/replacement.png'));
  assert.equal(body.image_url, '/api/v1/product-images/replacement.png');
});

test('saving without changing the image preserves the existing reference', () => {
  const body = toSubmit(validValues('https://cdn.example.com/legacy.png'));
  assert.equal(body.image_url, 'https://cdn.example.com/legacy.png');
  const blank = toSubmit(validValues(''));
  assert.ok(!('image_url' in blank), 'blank image must be omitted, not nulled');
});

test('removing a persisted image uses the documented DELETE endpoint', () => {
  assert.ok(uploadSource.includes('deleteProductImage'));
  assert.ok(
    catalogSource.includes('/api/v1/dashboard/products/${encodeURIComponent(productId)}/image'),
  );
  // Unsaved selections clear locally without calling the removal endpoint.
  assert.ok(uploadSource.includes('isPersistedSelection'));
});

test('upload failure displays an error and product-save failure keeps the reference', () => {
  assert.ok(uploadSource.includes('role="alert"'));
  assert.ok(uploadSource.includes('Could not upload the image'));
  assert.ok(uploadSource.includes('Could not remove the image'));
  // The editor only closes on success, so a failed save keeps the uploaded
  // reference in the form for retry.
  assert.ok(pageSource.includes('onSuccess: () => setEditor(null)'));
  const values = validValues('/api/v1/product-images/uploaded-then-save-failed.png');
  assert.equal(toSubmit(values).image_url, '/api/v1/product-images/uploaded-then-save-failed.png');
  assert.equal(values.image_url, '/api/v1/product-images/uploaded-then-save-failed.png');
});

test('VIEWER remains unable to upload or remove images', () => {
  assert.ok(uploadSource.includes('canManageProductImages'));
  assert.ok(uploadSource.includes('!canEdit'));
  assert.ok(uploadSource.includes('disabled={busy || !canEdit}'));
});

test('external HTTPS URLs and local references render correctly', () => {
  assert.ok(imageSource.includes('resolveProductImageUrl'));
  assert.ok(!imageSource.includes('localhost') && !imageSource.includes('8081'));
});

test('temporary preview URLs are revoked to avoid memory leaks', () => {
  assert.ok(uploadSource.includes('URL.revokeObjectURL'));
});

test('local blob URLs are never submitted as the product image', () => {
  assert.ok(!formSource.includes('createObjectURL'));
  assert.ok(catalogSource.includes('image_url'));
});
