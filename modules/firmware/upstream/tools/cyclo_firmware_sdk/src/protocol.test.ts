import assert from "node:assert/strict";
import {
  Instruction,
  PacketStream,
  RESERVED_DXL,
  buildPacket,
  crc16,
  parseDxlStatus,
  parseDxlStatusPacket,
  parsePacket,
} from "./protocol.js";

const ping = buildPacket(1, Instruction.DxlPing, new Uint8Array(), RESERVED_DXL);
assert.equal(crc16(ping.subarray(0, ping.length - 2)), ping[ping.length - 2] | (ping[ping.length - 1] << 8));
assert.deepEqual(parsePacket(ping), { reserved: 0, id: 1, instruction: Instruction.DxlPing, params: new Uint8Array() });

const stuffed = buildPacket(1, Instruction.DxlWrite, Uint8Array.from([0x20, 0x00, 0xff, 0xff, 0xfd, 0x55]), RESERVED_DXL);
const parsedStuffed = parsePacket(stuffed);
assert.equal(parsedStuffed.instruction, Instruction.DxlWrite);
assert.deepEqual(Array.from(parsedStuffed.params), [0x20, 0x00, 0xff, 0xff, 0xfd, 0x55]);

const stream = new PacketStream();
assert.equal(stream.push(Uint8Array.from([0, 1, 2])).length, 0);
const chunks = stream.push(ping);
assert.equal(chunks.length, 1);
assert.deepEqual(parsePacket(chunks[0]), parsePacket(ping));

const status = buildPacket(1, Instruction.Status, Uint8Array.from([0, 0x8d, 0x13, 0x06]), RESERVED_DXL);
const dxlStatus = parseDxlStatus(status);
assert.equal(dxlStatus.error, 0);
assert.deepEqual(Array.from(dxlStatus.data), [0x8d, 0x13, 0x06]);
const fullDxlStatus = parseDxlStatusPacket(status);
assert.equal(fullDxlStatus.id, 1);
assert.equal(fullDxlStatus.error, 0);
assert.deepEqual(Array.from(fullDxlStatus.data), [0x8d, 0x13, 0x06]);

assert.equal(Instruction.DxlRegWrite, 0x04);
assert.equal(Instruction.DxlAction, 0x05);
assert.equal(Instruction.DxlFactoryReset, 0x06);
assert.equal(Instruction.DxlClear, 0x10);
assert.equal(Instruction.DxlSyncRead, 0x82);
assert.equal(Instruction.DxlSyncWrite, 0x83);
assert.equal(Instruction.DxlFastSyncRead, 0x8a);
assert.equal(Instruction.DxlBulkRead, 0x92);
assert.equal(Instruction.DxlBulkWrite, 0x93);
assert.equal(Instruction.DxlFastBulkRead, 0x9a);

console.log("protocol tests ok");
