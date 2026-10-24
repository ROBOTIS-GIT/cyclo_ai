// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSerialTransport } from './web-serial-transport.js';

function mockPort() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let readable: ReadableStream<Uint8Array> | null = null;
  let writable: WritableStream<Uint8Array> | null = null;
  let closeFails = false;
  const events: string[] = [];
  const port = {
    get readable() { return readable; },
    get writable() { return writable; },
    async open() {
      assert.equal(readable, null, 'port was not closed before reopening');
      assert.equal(writable, null);
      events.push('open');
      readable = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
      writable = new WritableStream<Uint8Array>();
    },
    async close() {
      assert.equal(readable?.locked, false, 'reader leaked');
      assert.equal(writable?.locked, false, 'writer leaked');
      if (closeFails) throw new Error('mock close failure');
      events.push('close');
      readable = null;
      writable = null;
    },
  } as unknown as SerialPort;
  return { port, events, failRead: () => controller.error(new Error('The device has been lost.')),
    endRead: () => controller.close(), failClose: (value: boolean) => { closeFails = value; } };
}

for (const eof of [false, true]) {
  test(`unexpected ${eof ? 'EOF' : 'read failure'} releases both streams before notification and permits reconnect`, async () => {
    const mock = mockPort();
    const first = new WebSerialTransport({ baudRate: 6000000, port: mock.port });
    let resolveClosed!: () => void;
    const closed = new Promise<void>(resolve => { resolveClosed = resolve; });
    first.onClose(() => {
      assert.equal(mock.port.readable, null);
      assert.equal(mock.port.writable, null);
      resolveClosed();
    });
    await first.open();
    assert.equal(first.isOpen, true);
    if (eof) mock.endRead(); else mock.failRead();
    await closed;
    assert.equal(first.isOpen, false);
    const next = new WebSerialTransport({ baudRate: 6000000, port: mock.port });
    await next.open();
    await next.close();
    assert.deepEqual(mock.events, ['open', 'close', 'open', 'close']);
  });
}

test('intentional close releases locks without reporting a disconnect', async () => {
  const mock = mockPort();
  const transport = new WebSerialTransport({ baudRate: 6000000, port: mock.port });
  let notifications = 0;
  transport.onClose(() => notifications++);
  await transport.open();
  await transport.close();
  assert.equal(notifications, 0);
  assert.deepEqual(mock.events, ['open', 'close']);
});

test('cleanup failure is reported and a subsequent explicit close can release the port', async () => {
  const mock = mockPort();
  const transport = new WebSerialTransport({ baudRate: 6000000, port: mock.port });
  const closed = new Promise<Error | undefined>(resolve => transport.onClose(resolve));
  await transport.open();
  mock.failClose(true);
  mock.failRead();
  assert.match((await closed)?.message ?? '', /device has been lost.*cleanup failed.*mock close failure/);
  assert.equal(mock.port.writable?.locked, false);
  mock.failClose(false);
  await transport.close();
  assert.deepEqual(mock.events, ['open', 'close']);
});
