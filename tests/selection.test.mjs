import test from 'node:test';
import assert from 'node:assert/strict';
import { TargetSession } from '../modules/dynamixel/selection.mjs';
const device = { id: 1, modelNumber: 1200, firmwareVersion: 52, baud: 57600 };
const bus = { port: '/MOCK', allowScan: true, allowConfigure: true };
const complete = {
  complete: true,
  closureConfirmed: true,
  busReservationReleased: true,
  devices: [device],
};
const choice = (ticket) => ({
  scanId: ticket.scanId,
  candidateId: ticket.candidates[0].candidateId,
  name: 'motor',
  confirmed: true,
  isolatedBus: true,
});
test('scan-only bus selects a read-only target without expanding permissions', async () => {
  const s = new TargetSession({ buses: { bench: { ...bus, allowConfigure: false } } });
  const ticket = s.recordScan({ ...bus, allowConfigure: false }, complete, async () => {});
  const selected = await s.select({ ...choice(ticket), isolatedBus: false });
  assert.equal(selected.allowScan, true);
  assert.equal(selected.allowConfigure, false);
  assert.equal(selected.addressingVerified, false);
});
test('incomplete or unreleased scan creates no usable selection', () => {
  const s = new TargetSession({});
  for (const key of ['complete', 'closureConfirmed', 'busReservationReleased'])
    assert.equal(
      s.recordScan(bus, { ...complete, [key]: false }, async () => {}),
      null,
    );
});
test('target-specific grants cannot be laundered into a different model or ID', async () => {
  const restricted = { ...bus, model: 1200, firmware: 52, id: 1, baud: 57600 };
  for (const change of [{ modelNumber: 1020, firmwareVersion: 42 }, { id: 2 }, { baud: 1000000 }]) {
    const s = new TargetSession({});
    const ticket = s.recordScan(
      restricted,
      { ...complete, devices: [{ ...device, ...change }] },
      async () => {},
    );
    await assert.rejects(s.select(choice(ticket)), /target-specific grant/);
    assert.equal(s.list().length, 0);
  }
});
test('selection expires, cross-session tokens and changed binding fail closed', async () => {
  let now = 1000;
  const s = new TargetSession({}, { clock: () => now, ttlMs: 10 });
  const ticket = s.recordScan(bus, complete, async () => {});
  now += 11;
  await assert.rejects(s.select(choice(ticket)), /expired/);
  await assert.rejects(new TargetSession({}).select(choice(ticket)), /another session/);
  const binding = s.recordScan(bus, complete, async () => {
    throw Error('port replaced');
  });
  await assert.rejects(s.select(choice(binding)), /port replaced/);
  assert.equal(s.list().length, 0);
});
test('new observation or operation context invalidates stale selection', async () => {
  const s = new TargetSession({});
  const first = s.recordScan(bus, complete, async () => {});
  s.recordScan(bus, complete, async () => {});
  await assert.rejects(s.select(choice(first)));
  let release;
  const ticket = s.recordScan(bus, complete, () => new Promise((r) => (release = r)));
  const selecting = s.select(choice(ticket));
  s.clearObservations(bus.port);
  release();
  await assert.rejects(selecting, /changed during selection/);
});
test('verified location advances only after closure and reservation release', async () => {
  const s = new TargetSession({});
  const ticket = s.recordScan(bus, complete, async () => {});
  await s.select(choice(ticket));
  s.settle('motor', {
    outcome: 'verified',
    closureConfirmed: true,
    busReservationReleased: true,
    location: { id: 7, baud: 1000000 },
  });
  assert.equal(s.target('motor').id, 7);
  assert.equal(s.target('motor').baud, 1000000);
  s.settle('motor', {
    outcome: 'verified',
    closureConfirmed: true,
    busReservationReleased: false,
    location: { id: 8, baud: 1000000 },
  });
  assert.throws(() => s.target('motor'), /reconciliation/);
  assert.equal(s.list()[0].id, 7);
});
test('failed and uncertain operations retire other handles on the bus', async () => {
  const s = new TargetSession({ targets: { a: { ...bus, id: 1 }, b: { ...bus, id: 2 } } });
  s.settle('a', {
    outcome: 'not_written',
    closureConfirmed: true,
    busReservationReleased: true,
    location: { id: 1, baud: 57600 },
  });
  assert.throws(() => s.target('a'));
  assert.throws(() => s.target('b'));
});

test('target-specific grants cannot change protocol, canonical catalog or axis cohort', async () => {
  const { TargetSession } = await import('../modules/dynamixel/selection.mjs');
  const original = {
    port: '/MOCK',
    model: 30,
    firmware: 52,
    id: 1,
    baud: 57600,
    protocol: 1,
    catalogId: 'mx_series/mx-28-2',
    peerIds: [],
    allowConfigure: true,
    allowScan: true,
  };
  for (const change of [{ protocol: 2 }, { catalogId: 'mx_series/mx-64-2' }, { peerIds: [2] }]) {
    const s = new TargetSession({ targets: { original } }),
      bus = s.resolve({ target: 'original' });
    const record = s.recordScan(
      bus,
      {
        complete: true,
        closureConfirmed: true,
        busReservationReleased: true,
        devices: [
          {
            id: 1,
            modelNumber: 30,
            firmwareVersion: 52,
            baud: 57600,
            protocol: change.protocol ?? 1,
            identityComplete: true,
          },
        ],
      },
      async () => {},
    );
    await assert.rejects(
      s.select({
        scanId: record.scanId,
        candidateId: record.candidates[0].candidateId,
        name: 'new',
        confirmed: true,
        isolatedBus: true,
        catalogId: change.catalogId ?? original.catalogId,
        peerIds: change.peerIds ?? [],
      }),
    );
  }
});
test('dual-axis selection requires both actually observed endpoints', async () => {
  const { TargetSession } = await import('../modules/dynamixel/selection.mjs');
  const candidate = (id) => ({
    id,
    modelNumber: 1090,
    firmwareVersion: 52,
    baud: 57600,
    protocol: 2,
    identityComplete: true,
  });
  for (const ids of [[1], [1, 2]]) {
    const s = new TargetSession({
        buses: { mock: { port: '/MOCK', allowScan: true, allowConfigure: true } },
      }),
      bus = s.resolve({ bus: 'mock' });
    const record = s.recordScan(
      bus,
      {
        complete: true,
        closureConfirmed: true,
        busReservationReleased: true,
        devices: ids.map(candidate),
      },
      async () => {},
    );
    const select = () =>
      s.select({
        scanId: record.scanId,
        candidateId: record.candidates[0].candidateId,
        name: 'dual',
        confirmed: true,
        isolatedBus: true,
        peerIds: [2],
      });
    if (ids.length === 1) await assert.rejects(select(), /Multiple responders|peer endpoint/);
    else assert.deepEqual((await select()).peerIds, [2]);
  }
});

test('one scan selects multiple motors and batch failure restores session state', async () => {
  const s = new TargetSession({});
  const scan = s.recordScan(
    bus,
    { ...complete, devices: [1, 2, 3].map((id) => ({ ...device, id })) },
    async () => {},
  );
  const candidates = scan.candidates.map((c, i) => ({
    candidateId: c.candidateId,
    name: 'motor' + i,
  }));
  await s.select({ ...choice(scan), name: 'first' });
  await s.select({ ...choice(scan), candidateId: candidates[1].candidateId, name: 'second' });
  assert.equal(s.list().length, 2);
  await assert.rejects(
    s.selectMany({
      scanId: scan.scanId,
      candidates: [candidates[2], { candidateId: 'missing', name: 'bad' }],
      confirmed: true,
    }),
  );
  assert.equal(s.list().length, 2);
  assert.equal(
    (await s.selectMany({ scanId: scan.scanId, candidates: [candidates[2]], confirmed: true }))[0]
      .id,
    3,
  );
});
test('fresh scan can reconcile a blocked target using its original name', async () => {
  const s = new TargetSession({});
  let ticket = s.recordScan(bus, complete, async () => {});
  await s.select(choice(ticket));
  s.retirePort(bus.port, 'uncertain transaction');
  ticket = s.recordScan(bus, complete, async () => {});
  assert.equal((await s.select(choice(ticket))).status, 'ready');
});
