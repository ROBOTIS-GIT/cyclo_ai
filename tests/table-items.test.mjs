import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEMS,
  tableFor,
  itemFor,
  writeRequest,
  readItems,
  writeItem,
} from '../modules/dynamixel/table.mjs';
import { MODELS, modelFor } from '../modules/dynamixel/registry.mjs';
import { fixture } from './fixtures/device.mjs';
const xm = modelFor(1020, 42, 'x_series/xm_series/xm430-w350', 2);
const target = {
  id: 1,
  baud: 57600,
  model: 1020,
  firmware: 42,
  protocol: 2,
  catalogId: xm.catalogId,
  addressingVerified: true,
};
const motor = (state = {}) => {
  const f = fixture({ state: { model: 1020, firmware: 42, ...state } });
  f.registers.set(38, 100);
  f.registers.set(48, 4095);
  f.registers.set(52, 0);
  return f;
};
test('all actuator families have an inventory, unresolved/duplicate rows are visible', () => {
  assert.equal(ITEMS.models.length, 89);
  for (const m of MODELS) {
    const items = tableFor(m);
    assert.ok(items.length, m.catalogId);
    for (const i of items) {
      assert.ok(i.source.blobSha);
      if (i.access === 'R') assert.equal(i.write.status, 'read-only');
      if (i.write.status === 'resolved') assert.ok(i.write.sources.length);
    }
  }
  assert.equal(ITEMS.summary.sourceTableRows, 5901);
  assert.ok(ITEMS.summary.unresolvedWritableRows > 0);
  assert.ok(
    ITEMS.models.flatMap((m) => m.items).some((i) => i.access === 'R/RW' && i.write.requiresItems),
  );
});
test('Operating Mode enum is discrete; read-only/unknown/unresolved items cannot write', () => {
  const mode = itemFor(xm, 'Operating Mode');
  assert.throws(() => writeRequest(xm, mode, 2), /enum/);
  assert.throws(() => writeRequest(xm, itemFor(xm, 'Model Number'), 1020), /read-only/);
  assert.throws(() => itemFor(xm, 'address:64'), /Unknown/);
  const legacy = modelFor(310, 42, 'mx_series/mx-64', 1);
  assert.throws(() => writeRequest(legacy, itemFor(legacy, 'Current'), 1), /Unresolved/);
});
test('Torque Enable can be explicitly enabled and disabled without a torque-off blanket', async () => {
  const f = motor();
  let r = await writeItem(f.connect, target, 'Torque Enable', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.deepEqual(f.writes, [['write', 1, 64, 1]]);
  r = await writeItem(f.connect, target, 'Torque Enable', 0);
  assert.equal(r.outcome, 'verified');
  assert.equal(f.writes.length, 2);
});
test('signed Goal Current works in current mode with torque on, rejects limits and permits inactive raw storage', async () => {
  const f = motor({ operatingMode: 0, torque: 1 });
  let r = await writeItem(f.connect, target, 'Goal Current', -10);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(r.observed, -10);
  assert.deepEqual(f.writes, [['write', 1, 102, 65526]]);
  r = await writeItem(f.connect, target, 'Goal Current', -101);
  assert.equal(r.outcome, 'not_written');
  assert.equal(f.writes.length, 1);
  const wrong = motor({ operatingMode: 3 });
  r = await writeItem(wrong.connect, target, 'Goal Current', 1);
  assert.equal(r.outcome, 'verified');
  assert.equal(wrong.writes.length, 1);
});
test('Goal Velocity and Position use live mode/limit conditions, never change torque or mode', async () => {
  const velocity = motor({ operatingMode: 1, torque: 1 });
  let r = await writeItem(velocity.connect, target, 'Goal Velocity', -40);
  assert.equal(r.outcome, 'verified', r.error);
  assert.deepEqual(velocity.writes, [['write', 1, 104, 4294967256]]);
  const position = motor({ operatingMode: 3, torque: 1 });
  r = await writeItem(position.connect, target, 'Goal Position', 1000);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(position.writes[0][2], 116);
  r = await writeItem(position.connect, target, 'Goal Position', 5000);
  assert.equal(r.outcome, 'not_written');
  assert.equal(position.writes.length, 1);
  const drive = motor({ operatingMode: 3, drive: 8 });
  r = await writeItem(drive.connect, target, 'Goal Position', 100);
  assert.equal(r.outcome, 'verified');
  assert.equal(drive.writes.length, 1);
  assert.ok(r.warnings.some((w) => w.includes('Drive Mode')));
});
test('Operating Mode requires torque off and returns side-effect warnings/snapshot', async () => {
  const on = motor({ torque: 1 });
  assert.equal((await writeItem(on.connect, target, 'Operating Mode', 1)).outcome, 'not_written');
  assert.equal(on.writes.length, 0);
  const off = motor();
  const r = await writeItem(off.connect, target, 'Operating Mode', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.ok(r.warnings.some((w) => w.includes('reset')));
  assert.ok(r.after);
  assert.deepEqual(off.writes, [['write', 1, 11, 1]]);
});
test('generic reads preserve raw legacy direction-bit bytes without guessed signed interpretation', async () => {
  const ax = modelFor(12, 42, 'ax_series/ax-12a', 1);
  const item = itemFor(ax, 'Present Speed');
  assert.equal(item.encoding, 'unresolved');
  const c = {
    ping: async () => ({ id: 1, present: true }),
    probe: async () => ({ id: 1, present: true }),
    read: async (id, address, size) =>
      address === 0
        ? Uint8Array.of(12, 0)
        : address === 2
          ? Uint8Array.of(42)
          : Uint8Array.of(1, 4).slice(0, size),
    close: async () => {},
  };
  const r = await readItems(
    async () => c,
    { id: 1, baud: 57600, model: 12, firmware: 42, protocol: 1, catalogId: ax.catalogId },
    ['Present Speed'],
  );
  assert.equal(r.outcome, 'read', r.error);
  assert.deepEqual(r.items[0].bytes, [1, 4]);
  assert.equal(r.items[0].value, undefined);
});
test('failed readback/open closure remains uncertain and is not retried', async () => {
  const f = motor();
  const connect = async (...args) => {
    const c = await f.connect(...args);
    return { ...c, read: async (id, a, w) => (a === 64 ? Uint8Array.of(0) : c.read(id, a, w)) };
  };
  const r = await writeItem(connect, target, 'Torque Enable', 1);
  assert.equal(r.outcome, 'uncertain');
  assert.equal(f.writes.length, 1);
  const error = Error('uncertain open');
  error.name = 'TransportClosureError';
  const failed = await readItems(
    async () => {
      throw error;
    },
    target,
    ['Torque Enable'],
  );
  assert.equal(failed.closureConfirmed, false);
});
test('generic direct item engine rejects invalid self-peer cohort before connect', async () => {
  let calls = 0;
  await assert.rejects(
    writeItem(
      async () => {
        calls++;
        throw Error('no');
      },
      {
        model: 1090,
        firmware: 52,
        id: 1,
        baud: 57600,
        protocol: 2,
        peerIds: [1],
        addressingVerified: true,
      },
      'Torque Enable',
      1,
    ),
    /Distinct/,
  );
  assert.equal(calls, 0);
});
test('all indexed scalar table rows read through one engine on mock models, including conditional R/RW rows', async () => {
  const { catalogDevice } = await import('./fixtures/catalog-device.mjs');
  let total = 0;
  for (const m of MODELS) {
    const f = catalogDevice(m);
    const rows = tableFor(m);
    for (let start = 0; start < rows.length; start += 16) {
      const part = rows.slice(start, start + 16);
      const r = await readItems(
        f.connect,
        f.request,
        part.map((i) => i.key),
      );
      assert.equal(r.outcome, 'read', `${m.catalogId}: ${r.error}`);
      assert.equal(r.items.length, part.length);
      total += r.items.length;
    }
  }
  assert.equal(total, ITEMS.summary.readableRawRows);
});
