// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { Adapter } from '../src/adapter.mjs';
import { Instruction } from '../../cyclo_firmware_sdk/dist/protocol.js';
import { mockBus, workflowConfig } from './fixtures/workflow.mjs';

const request = { target:'bench', id:1, changes:{baudRate:2000000} };
const writes = bus => bus.events.filter(e => e.instruction === Instruction.DxlWrite);
const opens = bus => bus.events.filter(e => e.open || e.openFailed).map(e => e.open ?? e.openFailed);
async function configure(options) {
  const bus = mockBus(options);
  const result = await new Adapter(workflowConfig, bus.runner).call('cyclo_configure', request);
  assert.equal(result.busReservationReleased, true);
  return {bus, data:result.data};
}

for (const options of [{dropInitialPing:true}, {dropSnapshot:true}, {openFailures:[1]}]) {
  test(`pre-write timeout ${JSON.stringify(options)} never sends an EEPROM write or probes a second baud`, async () => {
    const {bus, data} = await configure(options);
    assert.equal(data.outcome, 'not_written');
    assert.deepEqual(data.changes, []);
    assert.deepEqual(data.recovery, []);
    assert.equal(writes(bus).length, 0);
    assert.deepEqual(opens(bus), [1000000]);
    assert.equal(bus.memory[8], 3);
  });
}

for (const options of [{missingAck:true}, {writeFailure:'after'}]) {
  test(`accepted baud write ${JSON.stringify(options)} keeps ACK failure evidence and verifies once at new baud`, async () => {
    const {bus, data} = await configure(options);
    assert.equal(data.outcome, 'verified');
    assert.equal(data.changes[0].observedRaw, 4);
    assert.match(data.changes[0].writeStatusError, /timeout/);
    assert.deepEqual(writes(bus).map(e => e.params), [[8,0,4]]);
    assert.deepEqual(opens(bus), [1000000,2000000]);
    assert.deepEqual(data.recovery, []);
  });
}

test('write timeout before acceptance resolves the old baud with read-only probes and never retries EEPROM', async () => {
  const {bus, data} = await configure({writeFailure:'before'});
  assert.equal(data.outcome, 'unknown');
  assert.match(data.changes[0].writeStatusError, /before acceptance/);
  assert.deepEqual(data.recovery.map(p => p.baud), [2000000,1000000]);
  assert.ok(data.recovery[0].error);
  assert.equal(data.recovery[1].registers.baudRate, 3);
  assert.equal(writes(bus).length, 1);
  assert.equal(bus.memory[8], 3);
  assert.match(data.nextAction, /No write was retried/);
});

for (const options of [{dropBaudReadback:true}, {openFailures:[2]}]) {
  test(`post-write failure ${JSON.stringify(options)} finds the accepted baud without a second write`, async () => {
    const {bus, data} = await configure(options);
    assert.equal(data.outcome, 'unknown');
    assert.equal(data.changes[0].status, 'unknown');
    assert.deepEqual(data.recovery.map(p => p.baud), [2000000,1000000]);
    assert.equal(data.recovery[0].identity.modelNumber, 1200);
    assert.equal(data.recovery[0].registers.baudRate, 4);
    assert.ok(data.recovery[1].error);
    assert.equal(writes(bus).length, 1);
    assert.deepEqual(opens(bus), [1000000,2000000,2000000,1000000]);
    assert.match(data.nextAction, /inspect state before any new write/);
  });
}

for (const options of [{reconnectModel:1190}, {reconnectFirmware:51}]) {
  test(`reconnected wrong identity ${JSON.stringify(options)} cannot supply readback or recovery registers`, async () => {
    const {bus, data} = await configure(options);
    assert.equal(data.outcome, 'unknown');
    assert.match(data.error, /Identity mismatch/);
    assert.equal(data.changes[0].observedRaw, undefined);
    assert.ok(data.recovery.every(p => p.registers === undefined));
    assert.match(data.recovery[0].error, /Identity mismatch/);
    assert.equal(writes(bus).length, 1);
    assert.equal(bus.events.filter(e => e.baud===2000000 && e.instruction===Instruction.DxlRead).length, 0);
  });
}

test('failed reopened-port cleanup stops immediately, retaining write and candidate-baud evidence', async () => {
  const {bus, data} = await configure({openFailures:[2],openCleanupFailure:true});
  assert.equal(data.outcome, 'unknown');
  assert.equal(data.baud, 2000000);
  assert.equal(data.changes[0].status, 'unknown');
  assert.equal(writes(bus).length, 1);
  assert.deepEqual(opens(bus), [1000000,2000000]);
  assert.deepEqual(data.recovery, []);
  assert.match(data.recoverySkipped, /closure is unconfirmed/);
  assert.deepEqual(data.cleanupErrors, ['mock open cleanup unconfirmed']);
});

test('failed recovery connector cleanup stops before probing the old baud', async () => {
  const {bus, data} = await configure({openFailures:[2,3],openCleanupFailures:[3]});
  assert.equal(data.outcome, 'unknown');
  assert.equal(writes(bus).length, 1);
  assert.deepEqual(opens(bus), [1000000,2000000,2000000]);
  assert.equal(data.recovery.length, 1);
  assert.match(data.recovery[0].error, /cleanup unconfirmed/);
  assert.match(data.recoverySkipped, /closure is unconfirmed/);
});

test('scan stops on failed connector cleanup before opening another baud', async () => {
  const bus = mockBus({openFailures:[1],openCleanupFailure:true});
  const result = await new Adapter(workflowConfig,bus.runner).call('cyclo_serial_scan', {
    target:'bench',ids:[1],bauds:[1000000,2000000],timeoutMs:20,budgetMs:2000,
  });
  assert.equal(result.busReservationReleased, true);
  assert.equal(result.data.complete, false);
  assert.match(result.data.error, /closure is unconfirmed/);
  assert.deepEqual(opens(bus), [1000000]);
  assert.equal(writes(bus).length, 0);
});
