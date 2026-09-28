import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSimulatorQrPayload,
  isQrisPaymentMethod,
  isSafeSimulatorQrPayload,
  SIMULATOR_QR_SCHEME,
} from './qr.ts';

const PAYMENT_ID = '9dbaf7dc-7b19-482a-a925-fb8dc51df70c';

test('buildSimulatorQrPayload is deterministic and includes payment_id', () => {
  const a = buildSimulatorQrPayload(PAYMENT_ID);
  const b = buildSimulatorQrPayload(PAYMENT_ID);
  assert.equal(a, b);
  assert.equal(a, `${SIMULATOR_QR_SCHEME}://payment/${PAYMENT_ID}`);
  assert.ok(a.includes(PAYMENT_ID));
});

test('buildSimulatorQrPayload rejects empty payment id', () => {
  assert.throws(() => buildSimulatorQrPayload(''), /required/);
  assert.throws(() => buildSimulatorQrPayload('   '), /required/);
});

test('isSafeSimulatorQrPayload accepts simulator payload and rejects secrets / QRIS EMV', () => {
  const payload = buildSimulatorQrPayload(PAYMENT_ID);
  assert.equal(isSafeSimulatorQrPayload(payload, PAYMENT_ID), true);

  assert.equal(isSafeSimulatorQrPayload(payload, 'other-id'), false);
  assert.equal(
    isSafeSimulatorQrPayload(`pay-simulator://payment/${PAYMENT_ID}?api_key=abc`, PAYMENT_ID),
    false,
  );
  assert.equal(
    isSafeSimulatorQrPayload(`00020101021226${PAYMENT_ID}`, PAYMENT_ID),
    false,
  );
});

test('isQrisPaymentMethod is true only for QRIS', () => {
  assert.equal(isQrisPaymentMethod('QRIS'), true);
  assert.equal(isQrisPaymentMethod('qris'), true);
  assert.equal(isQrisPaymentMethod(' QRIS '), true);
  assert.equal(isQrisPaymentMethod('VA'), false);
  assert.equal(isQrisPaymentMethod('GOPAY'), false);
  assert.equal(isQrisPaymentMethod(''), false);
  assert.equal(isQrisPaymentMethod(undefined), false);
  assert.equal(isQrisPaymentMethod(null), false);
});
