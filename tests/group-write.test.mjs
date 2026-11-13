import test from 'node:test';
import assert from 'node:assert/strict';
import { planGroupWrite } from '../modules/dynamixel/group-write.mjs';
const target = (id, extra = {}) => ({
  id,
  port: '/MOCK',
  baud: 57600,
  protocol: 2,
  model: 1020,
  firmware: 42,
  catalogId: 'x_series/xm_series/xm430-w350',
  addressingVerified: true,
  ...extra,
});
const writes = (n = 3) =>
  Array.from({ length: n }, (_, i) => ({
    target: target(i + 1),
    item: 'Goal Position',
    value: 1024 + i,
  }));
test('three per-target goals compile to one native Sync Write', () => {
  const p = planGroupWrite(writes());
  assert.equal(p.instruction, 'syncWrite');
  assert.equal(p.entries.length, 3);
  assert.deepEqual(p.entries[0].bytes, [0, 4, 0, 0]);
});
test('group planner rejects duplicate IDs, mismatched buses, transitions and invalid values', () => {
  for (const mutate of [
    (w) => (w[1].target.id = 1),
    (w) => (w[1].target.port = '/OTHER'),
    (w) => (w[1].item = 'ID'),
    (w) => (w[1].value = 1.5),
  ]) {
    const w = writes();
    mutate(w);
    assert.throws(() => planGroupWrite(w));
  }
});
test('group writes never silently split oversized requests', () =>
  assert.throws(() => planGroupWrite(writes(220)), /packet/i));

import { writeManyItems } from '../modules/dynamixel/group-write.mjs';
import { readManyItems } from '../modules/dynamixel/group.mjs';
import { MODELS } from '../modules/dynamixel/registry.mjs';
test('cancellation before dispatch sends nothing; in-flight cancellation remains uncertain', async () => {
  const pre = new AbortController();
  pre.abort();
  let calls = 0;
  let r = await writeManyItems(
    async () => {
      calls++;
    },
    writes(),
    { signal: pre.signal },
  );
  assert.equal(r.outcome, 'not_written');
  assert.equal(calls, 0);
  const live = new AbortController();
  let closed = 0;
  r = await writeManyItems(
    async () => ({
      writeGroup: async (_, { signal }) => {
        assert.equal(signal, live.signal);
        calls++;
        live.abort();
        throw Error('cancelled in bridge');
      },
      close: async () => {
        closed++;
      },
    }),
    writes(),
    { signal: live.signal },
  );
  assert.equal(r.outcome, 'uncertain');
  assert.equal(calls, 1);
  assert.equal(closed, 1);
});
test('native preflight rejection is not misreported as a transmission attempt', async () => {
  const r = await writeManyItems(
    async () => ({
      writeGroup: async () => ({ outcome: 'not_written', transmission: { attempted: false } }),
      close: async () => {},
    }),
    writes(),
  );
  assert.equal(r.outcome, 'not_written');
  assert.equal(r.closureConfirmed, true);
});
for (const kind of ['p1', 'mixed'])
  test(`native read selection and batching ${kind}`, async () => {
    const mx = MODELS.find((m) => m.catalogId === 'mx_series/mx-28');
    const xl = MODELS.find((m) => m.catalogId === 'x_series/xl_series/xl320');
    const ts =
      kind === 'p1'
        ? Array.from({ length: 17 }, (_, i) =>
            target(i + 1, { catalogId: mx.catalogId, model: mx.modelNumbers[0], protocol: 1 }),
          )
        : [target(1), target(2, { catalogId: xl.catalogId, model: xl.modelNumbers[0] })];
    const batches = [];
    const r = await readManyItems(
      async () => ({
        ping: async (id) => ({
          id,
          modelNumber: ts.find((t) => t.id === id).model,
          firmwareVersion: 42,
        }),
        read: async () => Uint8Array.of(42),
        bulkRead: async (es) => {
          batches.push(es);
          return es.map((e) => ({ id: e.id, bytes: Array(e.size).fill(0) }));
        },
        close: async () => {},
      }),
      ts,
      'LED',
    );
    assert.equal(r.outcome, 'read', r.error);
    assert.equal(r.instruction, 'bulkRead');
    assert.equal(r.items.length, ts.length);
    if (kind === 'p1')
      assert.deepEqual(
        batches.map((b) => b.length),
        [15, 2],
      );
    else assert.notEqual(batches[0][0].address, batches[0][1].address);
  });

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createProductsServer } from '../modules/dynamixel/server.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
for (const outcome of ['verified', 'not_written', 'uncertain'])
  test(`MCP config targets group lease and session state: ${outcome}`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'cyclo-group-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const config = join(dir, 'policy.json');
    const targets = Object.fromEntries(
      [1, 2, 3].map((id) => [
        `motor${id}`,
        { ...target(id), port: join(dir, 'mock-bus'), allowConfigure: true },
      ]),
    );
    await writeFile(config, JSON.stringify({ targets }));
    let calls = 0;
    const server = await createProductsServer(
      { CYCLO_PRODUCTS_CONFIG: config },
      {
        lease: async () => ({
          port: join(dir, 'mock-bus'),
          verify: async () => {},
          release: async () => true,
        }),
        provider: {
          connect: async () => ({
            writeGroup: async (request) => {
              calls++;
              assert.equal(request.entries.length, 3);
              return { outcome, transmission: { attempted: outcome !== 'not_written' } };
            },
            close: async () => {},
          }),
        },
      },
    );
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    const c = new Client({ name: 'group-test', version: '1' });
    await c.connect(a);
    t.after(() => c.close());
    const args = {
      targets: [1, 2, 3].map((id) => ({ target: `motor${id}`, value: 1 })),
      item: 'LED',
    };
    const preview = await c.callTool({ name: 'dynamixel_write_many', arguments: args });
    assert.equal(preview.isError, undefined);
    assert.equal(calls, 0);
    const r = await c.callTool({
      name: 'dynamixel_write_many',
      arguments: { ...args, dryRun: false, confirmed: true },
    });
    assert.equal(r.isError, outcome === 'verified' ? undefined : true, JSON.stringify(r));
    assert.equal(r.structuredContent.outcome, outcome);
    assert.equal(r.structuredContent.busReservationReleased, true);
    assert.equal(calls, 1);
    const after = await c.callTool({ name: 'dynamixel_write_many', arguments: args });
    assert.equal(after.isError, outcome === 'uncertain' ? true : undefined);
  });
