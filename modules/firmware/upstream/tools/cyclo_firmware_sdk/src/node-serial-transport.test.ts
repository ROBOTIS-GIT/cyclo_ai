// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { SerialPort } from 'serialport';
import { NodeSerialTransport } from './node-serial-transport.js';
import { TransportClosureError } from './transport.js';

test('a failed post-open flush closes the opened serial handle before rejecting', async t => {
  const events: string[] = [];
  t.mock.method(SerialPort.prototype, 'open', function (this: SerialPort, callback?: (err: Error | null) => void) {
    events.push('open');
    Object.defineProperty(this, 'isOpen', { value: true, writable: true });
    callback?.(null);
    return this;
  });
  t.mock.method(SerialPort.prototype, 'flush', function (this: SerialPort, callback?: (err: Error | null) => void) {
    events.push('flush');
    callback?.(new Error('mock post-open flush failure'));
    return this;
  });
  t.mock.method(SerialPort.prototype, 'close', function (this: SerialPort, callback?: (err: Error | null) => void) {
    events.push('close');
    Object.defineProperty(this, 'isOpen', { value: false, writable: true });
    callback?.(null);
    return this;
  });
  const transport = new NodeSerialTransport({ path: '/mock/serial', baudRate: 2000000 });
  await assert.rejects(transport.open(), /post-open flush failure/);
  assert.deepEqual(events, ['open', 'flush', 'close']);
  assert.equal(transport.isOpen, false);
});

for (const flushFails of [false, true]) test(`unconfirmed ${flushFails ? 'open cleanup' : 'close'} retains the handle and refuses another open`, async t => {
  const events: string[] = [];
  t.mock.method(SerialPort.prototype, 'open', function (this: SerialPort, callback?: (err: Error | null) => void) {
    events.push('open');
    Object.defineProperty(this, 'isOpen', { value: true, writable: true });
    callback?.(null);
    return this;
  });
  t.mock.method(SerialPort.prototype, 'flush', function (this: SerialPort, callback?: (err: Error | null) => void) {
    events.push('flush');
    callback?.(flushFails ? new Error('mock flush failure') : null);
    return this;
  });
  t.mock.method(SerialPort.prototype, 'close', function (this: SerialPort, callback?: (err: Error | null) => void) {
    events.push('close');
    callback?.(new Error('mock close failure'));
    return this;
  });
  const transport = new NodeSerialTransport({ path: '/mock/serial', baudRate: 2000000 });
  if (flushFails) await assert.rejects(transport.open(), TransportClosureError);
  else {
    await transport.open();
    await assert.rejects(transport.close(), TransportClosureError);
  }
  assert.equal(transport.isOpen, true);
  await assert.rejects(transport.open(), /confirm closure/);
  assert.deepEqual(events, ['open', 'flush', 'close']);
});
