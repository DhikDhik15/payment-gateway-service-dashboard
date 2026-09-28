import test from 'node:test';
import assert from 'node:assert/strict';
import { openPaymentPage, safeHttpUrl } from './url.ts';

test('safeHttpUrl allows only absolute HTTP(S) links', () => {
  assert.equal(safeHttpUrl('https://pay.example/checkout'), 'https://pay.example/checkout');
  assert.equal(safeHttpUrl('http://localhost:8081/pay'), 'http://localhost:8081/pay');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('/relative'), null);
  assert.equal(safeHttpUrl(undefined), null);
});

test('openPaymentPage passes the exact backend URL to a new isolated tab', () => {
  const originalWindow = globalThis.window;
  const calls: unknown[][] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { open: (...args: unknown[]) => calls.push(args) },
  });

  try {
    assert.equal(openPaymentPage('https://payments.example/pay/opaque-id?source=backend#qr'), true);
    assert.deepEqual(calls, [['https://payments.example/pay/opaque-id?source=backend#qr', '_blank', 'noopener,noreferrer']]);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('openPaymentPage rejects missing or unsafe payment URLs', () => {
  const originalWindow = globalThis.window;
  let calls = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { open: () => { calls += 1; } },
  });

  try {
    assert.equal(openPaymentPage(null), false);
    assert.equal(openPaymentPage('javascript:alert(1)'), false);
    assert.equal(calls, 0);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});
