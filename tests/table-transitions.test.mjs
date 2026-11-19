import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, modelFor } from '../modules/dynamixel/registry.mjs';
import { writeItem } from '../modules/dynamixel/table.mjs';
import { fullTableDevice } from './fixtures/full-table-device.mjs';
import { TargetSession } from '../modules/dynamixel/selection.mjs';
const model = (id) => MODELS.find((m) => m.catalogId === id);
const xm = model('x_series/xm_series/xm430-w350');
test('complete multi-byte alias write preserves other bytes and inherits target range/access', async () => {
  const f = fullTableDevice(xm);
  for (let n = 1; n <= 4; n++) f.set('Indirect Address ' + n, 115 + n);
  const r = await writeItem(f.connect, f.request, 'Indirect Data 2', 4);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(r.effectiveItem, 'Goal Position@116');
  assert.equal(r.effectiveValue, 1024);
  assert.equal(f.get('Goal Position'), 1024);
  assert.deepEqual(f.writes[0].data, [0, 4, 0, 0]);
  assert.equal(f.writes[0].address, 224);
  f.set('Indirect Address 1', f.byName.get('Present Position').address);
  const ro = await writeItem(f.connect, f.request, 'Indirect Data 1', 1);
  assert.equal(ro.outcome, 'not_written');
  assert.match(ro.error, /read-only/);
  assert.equal(f.writes.length, 1);
});
test('alias cycles, incomplete groups and changed bindings never send a write', async () => {
  const cycle = fullTableDevice(xm);
  cycle.set('Indirect Address 1', 224);
  const c = await writeItem(cycle.connect, cycle.request, 'Indirect Data 1', 0);
  assert.equal(c.outcome, 'not_written');
  assert.match(c.error, /cycle/);
  assert.equal(cycle.writes.length, 0);
  const partial = fullTableDevice(xm);
  partial.set('Indirect Address 1', 116);
  const p = await writeItem(partial.connect, partial.request, 'Indirect Data 1', 1);
  assert.equal(p.outcome, 'not_written');
  assert.match(p.error, /complete|group/i);
  assert.equal(partial.writes.length, 0);
  const changed = fullTableDevice(xm);
  const connect = async (...args) => {
    const c = await changed.connect(...args);
    return { ...c, bind: async () => changed.set('Indirect Address 1', 64) };
  };
  const r = await writeItem(connect, changed.request, 'Indirect Data 1', 1);
  assert.equal(r.outcome, 'not_written');
  assert.match(r.error, /changed after confirmation/);
  assert.equal(changed.writes.length, 0);
});
test('nested alias inherits a complete writable field without widening target permissions', async () => {
  const f = fullTableDevice(xm);
  f.set('Indirect Address 1', 225);
  f.set('Indirect Address 2', 65);
  const r = await writeItem(f.connect, f.request, 'Indirect Data 1', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(f.get('LED'), 1);
  assert.equal(r.mappingEvidence.length, 2);
});
test('SRL1 uses Tx-only then actual READ verification; SRL0 reports intentional observability loss', async () => {
  const f = fullTableDevice(xm);
  let r = await writeItem(f.connect, f.request, 'Status Return Level', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(f.writes[0].expectStatus, false);
  r = await writeItem(f.connect, f.request, 'LED', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(f.writes[1].expectStatus, false);
  const zero = fullTableDevice(xm);
  r = await writeItem(zero.connect, zero.request, 'Status Return Level', 0);
  assert.equal(r.outcome, 'transmitted-unverifiable');
  assert.equal(r.observed, undefined);
  assert.equal(r.observability, 'read-disabled-by-command');
  const last = zero.calls.findIndex((c) => c[0] === 'write');
  assert.ok(!zero.calls.slice(last + 1).some((c) => c[0] === 'read'));
  const s = new TargetSession({ targets: { motor: { ...zero.request, port: '/MOCK' } } });
  s.settle('motor', { ...r, busReservationReleased: true });
  assert.equal(s.target('motor').observability, 'read-disabled-by-command');
});
test('alias to SRL inherits Tx-only/observability result instead of fabricating a byte readback', async () => {
  const f = fullTableDevice(xm);
  f.set('Indirect Address 1', f.byName.get('Status Return Level').address);
  const r = await writeItem(f.connect, f.request, 'Indirect Data 1', 0);
  assert.equal(r.outcome, 'transmitted-unverifiable');
  assert.equal(r.effectItem, 'Status Return Level');
  assert.equal(f.writes[0].expectStatus, false);
});
test('protocol handoff preflights destination, verifies identity/snapshot and advances session protocol', async () => {
  const f = fullTableDevice(xm);
  const r = await writeItem(f.connect, f.request, 'Protocol Type', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(r.location.protocol, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].expectStatus, false);
  const s = new TargetSession({ targets: { motor: { ...f.request, port: '/MOCK' } } });
  s.settle('motor', { ...r, busReservationReleased: true });
  assert.equal(s.target('motor').protocol, 1);
  const occupied = fullTableDevice(xm);
  const conn = async (rate, timeout, wire) => {
    const c = await occupied.connect(rate, timeout, wire);
    return wire === 1 ? { ...c, probe: async (id) => ({ id, present: true }) } : c;
  };
  const blocked = await writeItem(conn, occupied.request, 'Protocol Type', 1);
  assert.equal(blocked.outcome, 'not_written');
  assert.match(blocked.error, /already responds/);
  assert.equal(occupied.writes.length, 0);
});
test('Hybrid save reports processing/completed states without forcing torque or retrying', async () => {
  const y = model('y_series/ym070-210-a051-rh'),
    done = fullTableDevice(y);
  let r = await writeItem(done.connect, done.request, 'Hybrid Save', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(r.observed, 2);
  const pending = fullTableDevice(y, { pendingSave: true });
  r = await writeItem(pending.connect, pending.request, 'Hybrid Save', 1);
  assert.equal(r.outcome, 'accepted-pending', r.error);
  assert.equal(pending.writes.length, 1);
  const on = fullTableDevice(y, { torque: 1 });
  r = await writeItem(on.connect, on.request, 'Hybrid Save', 1);
  assert.equal(r.outcome, 'not_written');
  assert.equal(on.writes.length, 0);
});
test('Y watchdog error is a two-byte all-ones sentinel and blocks only documented goal writes', async () => {
  const y = model('y_series/ym070-210-a051-rh'),
    f = fullTableDevice(y);
  f.set('Bus Watchdog', 65535);
  const r = await writeItem(f.connect, f.request, 'Goal Current', 0);
  assert.equal(r.outcome, 'not_written');
  assert.match(r.error, /read-only/);
  assert.equal(f.writes.length, 0);
  const cleared = await writeItem(f.connect, f.request, 'Bus Watchdog', 0);
  assert.equal(cleared.outcome, 'verified');
});

test('Protocol2 Ping preserves identity with READ replies disabled and supports explicit RAM reply restoration', async () => {
  const f = fullTableDevice(xm);
  await writeItem(f.connect, f.request, 'Status Return Level', 0);
  const led = await writeItem(f.connect, f.request, 'LED', 1);
  assert.equal(led.outcome, 'transmitted-unverifiable', led.error);
  assert.equal(f.get('LED'), 1);
  const restore = await writeItem(f.connect, f.request, 'Status Return Level', 2);
  assert.equal(restore.outcome, 'verified', restore.error);
  assert.equal(restore.observed, 2);
  const crc = fullTableDevice(xm);
  const connect = async (...args) => {
    const c = await crc.connect(...args);
    return {
      ...c,
      read: async () => {
        const e = Error('CRC corruption');
        e.kind = 'communication';
        throw e;
      },
    };
  };
  const bad = await writeItem(connect, crc.request, 'LED', 1);
  assert.equal(bad.outcome, 'not_written');
  assert.equal(crc.writes.length, 0);
});
test('explicit device status error is never converted into success by an already-matching value', async () => {
  const f = fullTableDevice(xm);
  f.set('LED', 1);
  const connect = async (...args) => {
    const c = await f.connect(...args);
    return {
      ...c,
      write: async () => {
        const e = Error('Device status error: Data Range');
        e.kind = 'device-status';
        throw e;
      },
    };
  };
  const r = await writeItem(connect, f.request, 'LED', 1);
  assert.equal(r.outcome, 'uncertain');
  assert.equal(r.observed, undefined);
});

test('conditional external-port aliases inherit output-mode prerequisites', async () => {
  const f = fullTableDevice(model('p_series/ph42-020-s300-r'));
  f.set('External Port Mode 1', 1);
  f.set('Indirect Address 1', 600);
  f.set('Indirect Address 2', 601);
  const r = await writeItem(f.connect, f.request, 'Indirect Data 1', 1);
  assert.equal(r.outcome, 'verified', r.error);
  assert.equal(f.get('External Port Data 1'), 1);
  f.set('External Port Mode 1', 0);
  const count = f.writes.length;
  const blocked = await writeItem(f.connect, f.request, 'Indirect Data 1', 0);
  assert.equal(blocked.outcome, 'not_written');
  assert.equal(f.writes.length, count);
});
