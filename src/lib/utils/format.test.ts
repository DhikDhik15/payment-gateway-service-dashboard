import test from 'node:test';
import assert from 'node:assert';
import { dateOnlyToRFC3339EndOfDay } from './format.ts';

test('dateOnlyToRFC3339EndOfDay transforms valid date successfully', () => {
  const input = '2026-09-24';
  const result = dateOnlyToRFC3339EndOfDay(input);
  
  assert.ok(result);
  
  // Verify standard RFC3339 structure (e.g. 2026-09-24T23:59:59+07:00 or -05:00 etc)
  const regex = /^2026-09-24T23:59:59[+-]\d{2}:\d{2}$/;
  assert.ok(regex.test(result), `Result does not match expected format: ${result}`);
});

test('dateOnlyToRFC3339EndOfDay handles undefined, empty, and null correctly', () => {
  assert.strictEqual(dateOnlyToRFC3339EndOfDay(undefined), undefined);
  assert.strictEqual(dateOnlyToRFC3339EndOfDay(null), undefined);
  assert.strictEqual(dateOnlyToRFC3339EndOfDay(''), undefined);
  assert.strictEqual(dateOnlyToRFC3339EndOfDay('   '), undefined);
});

test('dateOnlyToRFC3339EndOfDay throws error on malformed date', () => {
  assert.throws(() => {
    dateOnlyToRFC3339EndOfDay('2026/09/24');
  }, /Invalid date format/);

  assert.throws(() => {
    dateOnlyToRFC3339EndOfDay('24-09-2026');
  }, /Invalid date format/);

  assert.throws(() => {
    dateOnlyToRFC3339EndOfDay('invalid-date');
  }, /Invalid date format/);
});

test('dateOnlyToRFC3339EndOfDay throws error on invalid calendar date (rollover)', () => {
  assert.throws(() => {
    dateOnlyToRFC3339EndOfDay('2026-02-30'); // February only has 28 days in 2026
  }, /Invalid calendar date/);
});
