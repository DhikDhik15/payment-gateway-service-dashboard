import test from 'node:test';
import assert from 'node:assert/strict';
import {
  errorMessage,
  errorDetails,
  fieldError,
  isErrorCode,
  isLastOwnerError,
  isMerchantInactiveError,
  isRateLimited,
  isStatus,
  retryAfterLabel,
} from './errors.ts';
import { ApiClientError } from './client.ts';

test('errorMessage passes through the ApiClientError message (sanitized by the client layer)', () => {
  // The client builds ApiClientError via publicMessage(), so error.message is
  // already the safe, allowlisted user-facing text by the time it reaches here.
  assert.equal(errorMessage(new ApiClientError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')), 'Invalid email or password.');
  assert.equal(
    errorMessage(new ApiClientError(403, 'INSUFFICIENT_ROLE', 'You do not have permission to perform this action.')),
    'You do not have permission to perform this action.',
  );
  assert.equal(
    errorMessage(new ApiClientError(409, 'DUPLICATE_ORDER', 'A payment with this merchant order ID already exists.')),
    'A payment with this merchant order ID already exists.',
  );
  assert.equal(
    errorMessage(new ApiClientError(500, 'REQUEST_FAILED', 'The service is temporarily unavailable.')),
    'The service is temporarily unavailable.',
  );
});

test('errorMessage returns the raw message for generic errors and a fallback when absent', () => {
  assert.equal(errorMessage(new Error('boom')), 'boom');
  assert.equal(errorMessage(null), 'Something went wrong. Please try again.');
  assert.equal(errorMessage(new ApiClientError(422, 'VALIDATION_ERROR', ''), 'custom fallback'), 'custom fallback');
});

test('errorMessage maps network and TypeError failures to a safe connection message', () => {
  assert.equal(errorMessage(new TypeError('failed to fetch')), 'Unable to reach the server. Check your connection and try again.');
});

test('isStatus and isErrorCode classify ApiClientError correctly', () => {
  const err = new ApiClientError(404, 'TRANSACTION_NOT_FOUND', 'not found');
  assert.ok(isStatus(err, 404));
  assert.ok(!isStatus(err, 500));
  assert.ok(isErrorCode(err, 'TRANSACTION_NOT_FOUND', 'REFUND_NOT_FOUND'));
  assert.ok(!isErrorCode(err, 'MERCHANT_INACTIVE'));
});

test('isMerchantInactiveError and isLastOwnerError match their codes', () => {
  assert.ok(isMerchantInactiveError(new ApiClientError(403, 'MERCHANT_INACTIVE', 'inactive')));
  assert.ok(!isMerchantInactiveError(new ApiClientError(403, 'INSUFFICIENT_ROLE', 'role')));
  assert.ok(isLastOwnerError(new ApiClientError(409, 'LAST_OWNER_REQUIRED', 'last owner')));
});

test('isRateLimited matches HTTP 429', () => {
  assert.ok(isRateLimited(new ApiClientError(429, 'RATE_LIMIT_EXCEEDED', 'too many')));
  assert.ok(!isRateLimited(new ApiClientError(500, 'REQUEST_FAILED', 'server')));
});

test('fieldError extracts a single field detail', () => {
  assert.equal(
    fieldError(
      new ApiClientError(422, 'VALIDATION_ERROR', '', undefined, { amount: ['must be positive'] }),
      'amount',
    ),
    'must be positive',
  );
  assert.equal(fieldError(new ApiClientError(500, 'REQUEST_FAILED', 'x'), 'amount'), undefined);
});

test('retryAfterLabel reports the Retry-After seconds when present', () => {
  assert.equal(
    retryAfterLabel(new ApiClientError(429, 'RATE_LIMIT_EXCEEDED', 'too many', undefined, undefined, 30)),
    '30s',
  );
  assert.equal(retryAfterLabel(new ApiClientError(500, 'REQUEST_FAILED', 'x')), undefined);
});

test('errorDetails returns the structured error details', () => {
  assert.deepEqual(
    errorDetails(new ApiClientError(422, 'VALIDATION_ERROR', '', undefined, { url: 'must be HTTPS' })),
    { url: 'must be HTTPS' },
  );
});
