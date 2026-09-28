import test from 'node:test';
import assert from 'node:assert/strict';
import { getSimulatorPaymentRefetchInterval } from './polling.ts';

test('simulator polling runs only while PENDING', () => {
  assert.equal(getSimulatorPaymentRefetchInterval('CREATED'), 2000);
  assert.equal(getSimulatorPaymentRefetchInterval('PENDING'), 2000);
  assert.equal(getSimulatorPaymentRefetchInterval('PAID'), false);
  assert.equal(getSimulatorPaymentRefetchInterval('FAILED'), false);
  assert.equal(getSimulatorPaymentRefetchInterval('EXPIRED'), false);
  assert.equal(getSimulatorPaymentRefetchInterval('CANCELLED'), false);
  assert.equal(getSimulatorPaymentRefetchInterval(undefined), false);
});
