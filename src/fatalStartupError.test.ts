import test from 'node:test';
import assert from 'node:assert/strict';
import { startupErrorMessage } from './fatalStartupError.ts';

test('startup error message surfaces fail-closed configuration errors', () => {
  assert.equal(
    startupErrorMessage(new Error('VITE_API_BASE_URL must be configured for a production dashboard build.')),
    'VITE_API_BASE_URL must be configured for a production dashboard build.',
  );
});

test('startup error message falls back for non-error values', () => {
  assert.equal(startupErrorMessage(undefined), 'The application could not be started.');
  assert.equal(startupErrorMessage(null), 'The application could not be started.');
  assert.equal(startupErrorMessage('plain string'), 'The application could not be started.');
  assert.equal(startupErrorMessage(new Error('')), 'The application could not be started.');
});
