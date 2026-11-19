import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createProductsServer } from '../modules/dynamixel/server.mjs';
import { inspectBytes } from '../modules/dynamixel/raw-read.mjs';

function fixture(options = {}) {
  const calls = [];
  const connect = async () => {
    calls.push('open');
    return {
      probe: async (id) =>
        options.absent
          ? null
          : { id, ...(options.protocol === 1 ? {} : { modelNumber: 65000, firmwareVersion: 6 }) },
      read: async (id, address, length) => {
        calls.push(['read', id, address, length]);
        if (options.readError) throw Error('CRC error');
        return Uint8Array.from({ length }, (_, i) => i);
      },
      syncRead: async (ids, address, length) => {
        calls.push(['syncRead', ids, address, length]);
        return ids.map((id) => ({ id, bytes: Array(length).fill(id) }));
      },
      close: async () => {
        calls.push('close');
        if (options.closeError) throw Error('closure uncertainty');
      },
    };
  };
  return { calls, connect };
}
test('unindexed controller Ping/raw reads do not require or invent actuator registers', async () => {
  const f = fixture();
  let r = await inspectBytes(f.connect, { ids: [200], baud: 6000000, protocol: 2 });
  assert.equal(r.outcome, 'read');
  assert.equal(r.identities[0].modelNumber, 65000);
  assert.equal(f.calls.filter(Array.isArray).length, 0);
  r = await inspectBytes(f.connect, {
    ids: [200],
    baud: 6000000,
    protocol: 2,
    address: 1000,
    length: 4,
  });
  assert.deepEqual(r.items[0].bytes, [0, 1, 2, 3]);
  assert.equal(r.closureConfirmed, true);
  assert.ok(!('value' in r.items[0]));
  const p1 = fixture({ protocol: 1 });
  r = await inspectBytes(p1.connect, {
    ids: [253],
    baud: 1000000,
    protocol: 1,
    address: 200,
    length: 4,
  });
  assert.equal(r.outcome, 'read');
  assert.equal(r.identities[0].modelNumber, undefined);
});
test('raw Sync Read is bounded and communication/closure failures stay explicit', async () => {
  const f = fixture();
  const r = await inspectBytes(f.connect, {
    ids: [2, 5],
    baud: 6000000,
    protocol: 2,
    address: 52,
    length: 4,
    synchronized: true,
  });
  assert.equal(r.outcome, 'read');
  assert.deepEqual(
    r.items.map((i) => i.bytes[0]),
    [2, 5],
  );
  assert.equal(f.calls.filter(Array.isArray).length, 1);
  for (const options of [{ readError: true }, { closeError: true }, { absent: true }]) {
    const f = fixture(options),
      r = await inspectBytes(f.connect, {
        ids: [2],
        baud: 6000000,
        protocol: 2,
        address: 52,
        length: 4,
      });
    assert.equal(r.outcome, 'failed');
    if (options.closeError) assert.equal(r.closureConfirmed, false);
  }
  for (const request of [
    { ids: [2, 2], baud: 6000000, protocol: 2 },
    { ids: [254], baud: 6000000, protocol: 2 },
    { ids: [2], baud: 6000000, protocol: 1, address: 255, length: 2 },
    { ids: [2], baud: 6000000, protocol: 1, address: 0, length: 4, synchronized: true },
  ])
    await assert.rejects(inspectBytes(f.connect, request));
});
test('raw MCP respects confirmation, offline, bus grants and configured endpoint bounds', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'cyclo raw policy '));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'operator.json');
  await writeFile(
    path,
    JSON.stringify({
      buses: {
        bench: { port: '/MOCK', allowScan: true },
        denied: { port: '/MOCK-DENIED', allowScan: false },
      },
      targets: {
        controller: {
          port: '/MOCK',
          model: 65000,
          firmware: 6,
          id: 200,
          baud: 6000000,
          protocol: 2,
          allowScan: true,
          allowConfigure: false,
        },
      },
    }),
  );
  for (const offline of [false, true]) {
    const f = fixture();
    let releases = 0;
    const server = await createProductsServer(
      { CYCLO_PRODUCTS_CONFIG: path, ...(offline ? { CYCLO_OFFLINE: '1' } : {}) },
      {
        provider: { connect: async (port, ...args) => f.connect(...args) },
        lease: async () => ({
          port: '/MOCK',
          verify: async () => {},
          release: async () => {
            releases++;
            return true;
          },
        }),
      },
    );
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    const c = new Client({ name: 'raw-policy', version: '1' });
    await c.connect(a);
    t.after(() => c.close());
    const call = (name, args) => c.callTool({ name, arguments: args });
    const base = { target: 'controller', address: 1000, length: 4, dryRun: false };
    assert.equal((await call('dynamixel_read_raw', base)).isError, true);
    assert.equal(f.calls.length, 0);
    for (const args of [
      { ...base, ids: [201] },
      { ...base, baud: 1000000 },
      {
        port: '/MOCK',
        ids: [200],
        baud: 6000000,
        protocol: 2,
        address: 1000,
        length: 4,
        dryRun: false,
      },
      {
        bus: 'denied',
        ids: [200],
        baud: 6000000,
        protocol: 2,
        address: 1000,
        length: 4,
        dryRun: false,
      },
    ])
      assert.equal((await call('dynamixel_read_raw', { ...args, confirmed: true })).isError, true);
    assert.equal(f.calls.length, 0);
    const r = await call('dynamixel_read_raw', { ...base, confirmed: true });
    if (offline) {
      assert.equal(r.isError, true);
      assert.equal(f.calls.length, 0);
      assert.equal(releases, 0);
    } else {
      assert.equal(r.structuredContent.outcome, 'read', JSON.stringify(r));
      assert.deepEqual(r.structuredContent.items[0].bytes, [0, 1, 2, 3]);
      assert.equal(releases, 1);
    }
  }
});

test('large Sync Read requests batch automatically and preserve every requested ID', async () => {
  const f = fixture(),
    ids = Array.from({ length: 23 }, (_, i) => i + 1);
  const result = await inspectBytes(f.connect, {
    ids,
    baud: 6000000,
    protocol: 2,
    address: 52,
    length: 4,
    synchronized: true,
  });
  assert.equal(result.outcome, 'read', result.error);
  assert.equal(result.batchCount, 2);
  assert.deepEqual(
    result.items.map((i) => i.id),
    ids,
  );
  assert.deepEqual(
    f.calls.filter(Array.isArray).map((c) => c[1].length),
    [16, 7],
  );
  const wide = fixture();
  const large = await inspectBytes(wide.connect, {
    ids,
    baud: 6000000,
    protocol: 2,
    address: 0,
    length: 1024,
    synchronized: true,
  });
  assert.equal(large.outcome, 'read');
  assert.equal(large.batchCount, 6);
});
test('cancellation between batches stops requests and closes the connection', async () => {
  const controller = new AbortController(),
    f = fixture();
  let requests = 0;
  const connect = async () => {
    const c = await f.connect();
    return {
      ...c,
      syncRead: async (...args) => {
        requests++;
        const result = await c.syncRead(...args);
        controller.abort();
        return result;
      },
    };
  };
  const result = await inspectBytes(
    connect,
    {
      ids: Array.from({ length: 23 }, (_, i) => i + 1),
      baud: 6000000,
      protocol: 2,
      address: 52,
      length: 4,
      synchronized: true,
    },
    { signal: controller.signal },
  );
  assert.equal(result.outcome, 'failed');
  assert.equal(result.closureConfirmed, true);
  assert.equal(requests, 1);
  assert.equal(f.calls.at(-1), 'close');
});
