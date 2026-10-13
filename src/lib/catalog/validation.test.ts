import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRupiahInput,
  isValidImageUrl,
  isValidProductImageReference,
  productFormSchema,
  categoryFormSchema,
} from './validation.ts';

test('parseRupiahInput strips thousand separators without floats', () => {
  assert.equal(parseRupiahInput('15000'), 15000);
  assert.equal(parseRupiahInput('12.500'), 12500);
  assert.equal(parseRupiahInput('1 000 000'), 1000000);
  assert.equal(parseRupiahInput('Rp15.000'), 15000);
  assert.equal(parseRupiahInput(''), null);
  assert.equal(parseRupiahInput('   '), null);
  assert.equal(parseRupiahInput('abc'), null);
});

test('isValidImageUrl accepts only absolute HTTPS URLs', () => {
  assert.equal(isValidImageUrl('https://cdn.example.com/p/a.png?x=1'), true);
  assert.equal(isValidImageUrl('https://cdn.example.com:8443/a'), true);
  assert.equal(isValidImageUrl('http://cdn.example.com/a.png'), false);
  assert.equal(isValidImageUrl('ftp://cdn.example.com/a.png'), false);
  assert.equal(isValidImageUrl('javascript:alert(1)'), false);
  assert.equal(isValidImageUrl('file:///etc/passwd'), false);
  assert.equal(isValidImageUrl('/images/a.png'), false);
  assert.equal(isValidImageUrl('images/a.png'), false);
  assert.equal(isValidImageUrl('https://'), false);
  assert.equal(isValidImageUrl('https://user:pass@cdn.example.com/a.png'), false);
  assert.equal(isValidImageUrl('https://user@cdn.example.com/a.png'), false);
  assert.equal(isValidImageUrl(''), false);
  assert.equal(isValidImageUrl('   '), false);
  assert.equal(isValidImageUrl(`https://cdn.example.com/${'a'.repeat(2048)}`), false);
});

test('productFormSchema enforces contract rules', () => {
  const base = {
    name: 'Arabica 250g',
    sku: '',
    description: '',
    priceInput: '85000',
    currency: 'IDR',
    category_id: '',
    image_url: '',
    active: true,
  } as const;
  assert.ok(productFormSchema.safeParse(base).success);

  // Blank name rejected.
  assert.equal(productFormSchema.safeParse({ ...base, name: '   ' }).success, false);
  // Negative and decimal prices rejected.
  assert.equal(productFormSchema.safeParse({ ...base, priceInput: '-5' }).success, false);
  assert.equal(productFormSchema.safeParse({ ...base, priceInput: '12,500' }).success, false);
  assert.equal(productFormSchema.safeParse({ ...base, priceInput: '' }).success, false);
  // Non-IDR currency rejected.
  assert.equal(
    productFormSchema.safeParse({ ...base, currency: 'USD' }).success,
    false,
  );
  // Non-HTTPS image rejected; blank image allowed (means no image).
  assert.equal(
    productFormSchema.safeParse({ ...base, image_url: 'http://x.test/a.png' }).success,
    false,
  );
  assert.ok(
    productFormSchema.safeParse({
      ...base,
      image_url: 'https://cdn.example.com/a.png',
    }).success,
  );
  // Backend-local upload references are accepted (upload flow output).
  assert.ok(
    productFormSchema.safeParse({
      ...base,
      image_url: '/api/v1/product-images/9f2c4a1b.jpg',
    }).success,
  );
  // Local blob previews must never be submitted as the product image.
  assert.equal(
    productFormSchema.safeParse({ ...base, image_url: 'blob:http://localhost/abc' }).success,
    false,
  );
  // Name length follows the backend contract.
  assert.equal(
    productFormSchema.safeParse({ ...base, name: 'x'.repeat(201) }).success,
    false,
  );
});

test('isValidProductImageReference accepts uploaded refs and HTTPS, rejects blobs', () => {
  assert.equal(isValidProductImageReference(''), true);
  assert.equal(isValidProductImageReference('   '), true);
  assert.equal(isValidProductImageReference('https://cdn.example.com/a.png'), true);
  assert.equal(isValidProductImageReference('/api/v1/product-images/abc123.png'), true);
  assert.equal(isValidProductImageReference('http://x.test/a.png'), false);
  assert.equal(isValidProductImageReference('blob:http://localhost/abc'), false);
  assert.equal(isValidProductImageReference('data:image/png;base64,aaa'), false);
  assert.equal(isValidProductImageReference('images/a.png'), false);
  assert.equal(isValidProductImageReference('/api/v1/product-images/has space.png'), false);
});

test('categoryFormSchema enforces contract rules', () => {
  assert.ok(categoryFormSchema.safeParse({ name: 'Beans', description: '' }).success);
  assert.equal(categoryFormSchema.safeParse({ name: '' }).success, false);
  assert.equal(categoryFormSchema.safeParse({ name: '   ' }).success, false);
  assert.equal(
    categoryFormSchema.safeParse({ name: 'x'.repeat(101) }).success,
    false,
  );
});
