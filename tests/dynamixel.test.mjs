import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configure,
  scan,
  scanPlan,
  configurationPlan,
  validateRequest,
} from '../modules/dynamixel/workflow.mjs';
import { encode } from '../modules/dynamixel/registry.mjs';
import { fixture } from './fixtures/device.mjs';

const request = (changes, extra = {}) => ({
  id: 1,
  baud: 57600,
  model: 1200,
  firmware: 52,
  isolatedBus: true,
  changes,
  ...extra,
});
test('LED verified; no goal/torque addresses written', async () => {
  const f = fixture();
  const r = await configure(f.connect, request({ led: 1 }));
  assert.equal(r.outcome, 'verified');
  assert.deepEqual(f.writes, [['write', 1, 65, 1]]);
});
test('ID transition verifies new ID, detects collision first', async () => {
  const f = fixture();
  const r = await configure(f.connect, request({ id: 7 }));
  assert.equal(r.outcome, 'verified');
  assert.equal(r.location.id, 7);
  assert.ok(f.calls.some((c) => c[0] === 'ping' && c[1] === 7));
  assert.deepEqual(f.writes, [['write', 1, 7, 7]]);
  const occupied = fixture({ occupied: true });
  assert.equal((await configure(occupied.connect, request({ id: 7 }))).outcome, 'not_written');
  assert.equal(occupied.writes.length, 0);
});
test('baud transition closes original connection and verifies new rate', async () => {
  const f = fixture();
  const r = await configure(f.connect, request({ baud: 1000000 }));
  assert.equal(r.outcome, 'verified');
  assert.deepEqual(
    f.calls.filter((c) => c[0] === 'connect'),
    [
      ['connect', 57600],
      ['connect', 1000000],
      ['connect', 57600],
      ['connect', 1000000],
    ],
  );
  assert.equal(r.location.baud, 1000000);
  assert.deepEqual(f.writes, [['write', 1, 8, 3]]);
});
test('lost ACK with successful readback is verified without repeated write', async () => {
  const f = fixture({ ackLost: true });
  assert.equal((await configure(f.connect, request({ id: 7 }))).outcome, 'verified');
  assert.equal(f.writes.length, 1);
});
for (const [label, options] of Object.entries({
  mismatch: { readbackMismatch: true },
  'failed write': { failBeforeApply: true },
  'lost transition': { lostAfterWrite: true },
}))
  test(`${label}: uncertain result, no repeated writes`, async () => {
    const f = fixture(options);
    const r = await configure(f.connect, request({ led: 1 }));
    assert.equal(r.outcome, 'uncertain');
    assert.equal(f.writes.length, 1);
    assert.equal(r.recovery.length, 1);
  });
for (const [field, value] of [
  ['model', 1020],
  ['firmware', 99],
  ['protocol', 1],
])
  test(`observed ${field} mismatch blocks all writes`, async () => {
    const f = fixture({ state: { [field]: value } });
    assert.equal((await configure(f.connect, request({ led: 1 }))).outcome, 'not_written');
    assert.equal(f.writes.length, 0);
  });
test('unknown model and missing firmware rejected before connect; no raw fields or combined ID/baud', async () => {
  const f = fixture();
  for (const r of [
    request({ led: 1 }, { model: 999 }),
    request({ led: 1 }, { firmware: undefined }),
    request({ address: 64, value: 1 }),
    request({ id: 2, baud: 1000000 }),
    request({ led: 2 }),
  ])
    await assert.rejects(configure(f.connect, r));
  assert.equal(f.calls.length, 0);
});
test('unavailable port is not a successful device operation', async () => {
  const f = fixture({ openFailure: true });
  const r = await configure(f.connect, request({ id: 2 }));
  assert.equal(r.outcome, 'not_written');
  assert.equal(f.writes.length, 0);
});
test('verified addressing is required despite a clear destination ping', async () => {
  const f = fixture();
  await assert.rejects(configure(f.connect, request({ id: 2 }, { isolatedBus: false })));
  assert.equal(f.calls.length, 0);
});
test('interrupted ID and baud transitions remain uncertain', async () => {
  for (const changes of [{ id: 2 }, { baud: 1000000 }]) {
    const controller = new AbortController(),
      f = fixture({ abortAfterWrite: () => controller.abort() });
    const r = await configure(f.connect, request(changes), { signal: controller.signal });
    assert.equal(r.outcome, 'uncertain');
    assert.equal(f.writes.length, 1);
    assert.equal(f.calls.filter((c) => c[0] === 'connect').length, 'baud' in changes ? 3 : 1);
  }
});
test('unconfirmed close never reopens bus', async () => {
  const f = fixture({ closeFailure: true });
  const r = await configure(f.connect, request({ baud: 1000000 }));
  assert.equal(r.outcome, 'not_written');
  assert.equal(f.writes.length, 0);
  assert.equal(r.closureConfirmed, false);
  assert.equal(f.calls.filter((c) => c[0] === 'connect').length, 1);
});
test('time profile conversion preserves reverse bit and never sends a goal', async () => {
  const f = fixture({ state: { drive: 5 } });
  const r = await configure(
    f.connect,
    request({ profile: { mode: 'time', totalMs: 1000, accelerationMs: 400 } }),
  );
  assert.equal(r.outcome, 'verified');
  assert.deepEqual(
    f.writes.map((c) => c.slice(2)),
    [
      [108, 400],
      [112, 1000],
    ],
  );
});
test('velocity profile uses explicit units, rounds down and enforces application limits', async () => {
  const f = fixture();
  const p = {
    mode: 'velocity',
    rpm: 10,
    accelerationRpm2: 500,
    maxRpm: 20,
    maxAccelerationRpm2: 1000,
  };
  const r = await configure(f.connect, request({ profile: p }));
  assert.equal(r.outcome, 'verified');
  assert.deepEqual(
    f.writes.map((c) => c.slice(2)),
    [
      [108, 2],
      [112, 43],
    ],
  );
  assert.throws(() => validateRequest(request({ profile: { ...p, maxRpm: 5 } })));
  assert.throws(() => validateRequest(request({ profile: { ...p, rpm: 0 } })));
  assert.throws(() => validateRequest(request({ profile: { ...p, maxRpm: undefined } })));
});
test('mode/table mismatch and time-shape mismatch fail closed', async () => {
  for (const state of [{ operatingMode: 1 }]) {
    const f = fixture({ state });
    assert.equal(
      (
        await configure(
          f.connect,
          request({ profile: { mode: 'time', totalMs: 100, accelerationMs: 30 } }),
        )
      ).outcome,
      'not_written',
    );
    assert.equal(f.writes.length, 0);
  }
  assert.throws(() =>
    validateRequest(request({ profile: { mode: 'time', totalMs: 100, accelerationMs: 51 } })),
  );
});
test('XM430 caller permits current-position profile in the existing mode5', async () => {
  const f = fixture({ state: { model: 1020, firmware: 42, operatingMode: 5, drive: 4 } });
  const r = await configure(
    f.connect,
    request(
      { profile: { mode: 'time', totalMs: 1000, accelerationMs: 100 } },
      { model: 1020, firmware: 42 },
    ),
  );
  assert.equal(r.outcome, 'verified');
});
test('bounded scan finds mixed rates, requires selection, closes each connection', async () => {
  const connect = async (baud) => ({
    probe: async (id) =>
      id === 1
        ? {
            id,
            modelNumber: baud === 57600 ? 1200 : 1020,
            firmwareVersion: baud === 57600 ? 52 : 42,
          }
        : null,
    close: async () => {},
  });
  const r = await scan(connect, { ids: [1, 2], protocols: [2], bauds: [57600, 1000000] });
  assert.equal(r.devices.length, 2);
  assert.equal(r.selectionRequired, true);
  assert.equal(r.complete, true);
  assert.deepEqual(
    r.devices.map((d) => d.baud),
    [57600, 1000000],
  );
});
test('scan limits, cancellation and errors never become absence proof', async () => {
  assert.throws(() => scanPlan({ ids: [1, 1], protocols: [2], bauds: [57600] }));
  const fullBus = {
    ids: Array.from({ length: 253 }, (_, i) => i),
    protocols: [2],
    bauds: [57600, 1000000],
  };
  const plan = scanPlan(fullBus);
  assert.ok(plan.budgetMs >= plan.estimatedMs);
  assert.equal(scanPlan({ ...fullBus, budgetMs: 100 }).budgetMs, 100);
  let now = 0;
  const bounded = fixture();
  const partial = await scan(
    bounded.connect,
    { ...fullBus, budgetMs: 100 },
    { clock: () => (now += 10) },
  );
  assert.equal(partial.complete, false);
  assert.ok(partial.completed < partial.planned);
  const c = new AbortController();
  c.abort();
  const f = fixture();
  assert.equal(
    (await scan(f.connect, { ids: [1], protocols: [2], bauds: [57600] }, { signal: c.signal }))
      .complete,
    false,
  );
  assert.equal(f.calls.length, 0);
  const bad = fixture({ probeError: true });
  assert.equal(
    (await scan(bad.connect, { ids: [1], protocols: [2], bauds: [57600] })).complete,
    false,
  );
});
test('scan close failure stops before next baud', async () => {
  const f = fixture({ closeFailure: true });
  const r = await scan(f.connect, { ids: [1], protocols: [2], bauds: [57600, 1000000] });
  assert.equal(r.closureConfirmed, false);
  assert.equal(f.calls.filter((c) => c[0] === 'connect').length, 1);
});
test('ping model and control-table model mismatch blocks writes', async () => {
  const f = fixture();
  f.registers.set(0, 1020);
  const r = await configure(f.connect, request({ led: 1 }));
  assert.equal(r.outcome, 'not_written');
  assert.match(r.error, /Control-table identity/);
  assert.equal(f.writes.length, 0);
});
test('destination ID response with unrelated snapshot is not transition continuity', async () => {
  const f = fixture();
  const connect = async (baud) => {
    const c = await f.connect(baud),
      write = c.write;
    c.write = async (...args) => {
      await write(...args);
      f.registers.set(44, 999);
    };
    return c;
  };
  const r = await configure(connect, request({ id: 7 }));
  assert.equal(r.outcome, 'uncertain');
  assert.match(r.error, /continuity mismatch: velocityLimit/);
  assert.equal(f.writes.length, 1);
});
test('failed open with unknown closure prevents scan reconnect and preserves uncertainty', async () => {
  let opens = 0;
  const connect = async () => {
    opens++;
    const e = new Error('open failed; closure unconfirmed');
    e.name = 'TransportClosureError';
    throw e;
  };
  const r = await scan(connect, { ids: [1], protocols: [2], bauds: [57600, 1000000] });
  assert.equal(opens, 1);
  assert.equal(r.closureConfirmed, false);
  const c = await configure(connect, request({ id: 2 }));
  assert.equal(c.closureConfirmed, false);
  assert.equal(c.outcome, 'not_written');
});
