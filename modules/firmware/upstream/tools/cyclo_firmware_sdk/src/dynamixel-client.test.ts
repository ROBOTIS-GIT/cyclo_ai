import assert from "node:assert/strict";

import { DynamixelClient } from "./dynamixel-client.js";
import { Instruction, RESERVED_DXL, buildPacket, parsePacket } from "./protocol.js";
import type { PacketSession } from "./session.js";

class FakeSession {
  written: Uint8Array[] = [];
  packets: Uint8Array[] = [];
  flushCount = 0;

  async write(data: Uint8Array): Promise<void> {
    this.written.push(data.slice());
  }

  async flush(): Promise<void> {
    this.flushCount++;
  }

  async waitForPacket(): Promise<Uint8Array> {
    const packet = this.packets.shift();
    if (!packet) {
      throw new Error("no queued packet");
    }
    return packet;
  }
}

function clientWith(fake: FakeSession, id = 1): DynamixelClient {
  return new DynamixelClient(fake as unknown as PacketSession, id);
}

function lastPacket(fake: FakeSession) {
  assert.ok(fake.written.length > 0);
  return parsePacket(fake.written[fake.written.length - 1]);
}

const syncWriteSession = new FakeSession();
await clientWith(syncWriteSession).syncWrite(0x30, [
  { id: 1, data: Uint8Array.from([0x11, 0x22]) },
  { id: 2, data: Uint8Array.from([0x33, 0x44]) },
]);
let packet = lastPacket(syncWriteSession);
assert.equal(packet.id, 0xfe);
assert.equal(packet.instruction, Instruction.DxlSyncWrite);
assert.deepEqual(Array.from(packet.params), [0x30, 0x00, 0x02, 0x00, 1, 0x11, 0x22, 2, 0x33, 0x44]);

const bulkReadSession = new FakeSession();
bulkReadSession.packets.push(
  buildPacket(1, Instruction.Status, Uint8Array.from([0, 0xaa, 0xbb]), RESERVED_DXL),
  buildPacket(2, Instruction.Status, Uint8Array.from([0, 0xcc]), RESERVED_DXL),
);
const bulkStatuses = await clientWith(bulkReadSession).bulkRead([
  { id: 1, address: 0x40, length: 2 },
  { id: 2, address: 0x50, length: 1 },
]);
packet = lastPacket(bulkReadSession);
assert.equal(packet.id, 0xfe);
assert.equal(packet.instruction, Instruction.DxlBulkRead);
assert.deepEqual(Array.from(packet.params), [1, 0x40, 0x00, 0x02, 0x00, 2, 0x50, 0x00, 0x01, 0x00]);
assert.deepEqual(bulkStatuses.map((status) => [status.id, Array.from(status.data)]), [
  [1, [0xaa, 0xbb]],
  [2, [0xcc]],
]);

const fastSyncSession = new FakeSession();
fastSyncSession.packets.push(buildPacket(0xfe, Instruction.Status, Uint8Array.from([0, 1, 0x7b]), RESERVED_DXL));
const fastSyncStatuses = await clientWith(fastSyncSession).fastSyncRead(0x20, 1, [1]);
packet = lastPacket(fastSyncSession);
assert.equal(packet.id, 0xfe);
assert.equal(packet.instruction, Instruction.DxlFastSyncRead);
assert.deepEqual(Array.from(packet.params), [0x20, 0x00, 0x01, 0x00, 1]);
assert.deepEqual(fastSyncStatuses.map((status) => [status.id, Array.from(status.data)]), [
  [1, [0x7b]],
]);

const clearSession = new FakeSession();
clearSession.packets.push(buildPacket(1, Instruction.Status, Uint8Array.from([0]), RESERVED_DXL));
await clientWith(clearSession).clearMultiTurn();
packet = lastPacket(clearSession);
assert.equal(packet.instruction, Instruction.DxlClear);
assert.deepEqual(Array.from(packet.params), [0x01, 0x44, 0x58, 0x4c, 0x22]);

const rawSession = new FakeSession();
rawSession.packets.push(buildPacket(1, Instruction.Status, Uint8Array.from([0, 0x99]), RESERVED_DXL));
const rawStatuses = await clientWith(rawSession).sendInstruction(0x7f, Uint8Array.from([0x01, 0x02]));
packet = lastPacket(rawSession);
assert.equal(packet.instruction, 0x7f);
assert.deepEqual(Array.from(packet.params), [0x01, 0x02]);
assert.deepEqual(Array.from(rawStatuses[0].data), [0x99]);

console.log("dynamixel client tests ok");
