import test from 'node:test';
import assert from 'node:assert/strict';
import { readValue } from '../modules/dynamixel/read-value.mjs';

test('nonstandard integer widths read without a scalar write-width restriction', () => {
  assert.deepEqual(readValue(Uint8Array.of(255, 255, 127), 'unsigned'), {
    rawUnsigned: 8388607,
    value: 8388607,
  });
  assert.deepEqual(readValue(Uint8Array.of(255, 255, 255), 'twos-complement'), {
    rawUnsigned: 16777215,
    value: -1,
  });
});
test('64-bit read values remain exact decimal strings', () => {
  const bytes = new Uint8Array(8).fill(255);
  assert.deepEqual(readValue(bytes, 'unsigned'), {
    rawUnsignedDecimal: '18446744073709551615',
    valueDecimal: '18446744073709551615',
  });
  assert.deepEqual(readValue(bytes, 'twos-complement'), {
    rawUnsignedDecimal: '18446744073709551615',
    valueDecimal: '-1',
  });
  assert.deepEqual(readValue(bytes, 'unresolved'), { rawUnsignedDecimal: '18446744073709551615' });
  assert.deepEqual(readValue(new Uint8Array(16), 'unsigned'), {});
});
