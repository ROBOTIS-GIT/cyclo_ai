import {
  BROADCAST_ID,
  DxlStatus,
  DxlPingInfo,
  Instruction,
  RESERVED_DXL,
  buildPacket,
  parseDxlStatus,
  parseDxlStatusPacket,
  readU16LE,
  writeU16LE,
} from "./protocol.js";
import { PacketSession } from "./session.js";

export interface DxlCommandOptions {
  id?: number;
  timeoutMs?: number;
  statusCount?: number;
  throwOnError?: boolean;
  byteStuff?: boolean;
}

export interface DxlBulkReadEntry {
  id: number;
  address: number;
  length: number;
}

export interface DxlBulkWriteEntry {
  id: number;
  address: number;
  data: Uint8Array;
}

export interface DxlSyncWriteEntry {
  id: number;
  data: Uint8Array;
}

export class DynamixelClient {
  private transactionTail: Promise<unknown> = Promise.resolve();

  constructor(readonly session: PacketSession, private id = 1) {}

  setId(id: number): void {
    this.id = id;
  }

  getId(): number {
    return this.id;
  }

  async ping(timeoutMs = 1000): Promise<DxlPingInfo> {
    return this.transaction(async () => {
      await this.session.write(buildPacket(this.id, Instruction.DxlPing, new Uint8Array(), RESERVED_DXL));
      const status = await this.waitForMatchingStatus(timeoutMs, "ping", (candidate) =>
        candidate.id === this.id && candidate.data.length === 3);
      throwOnDxlError(status.error, "ping");
      return {
        id: status.id,
        modelNumber: readU16LE(status.data, 0),
        firmwareVersion: status.data[2],
      };
    });
  }

  async sendInstruction(instruction: number, params: Uint8Array = new Uint8Array(), options: DxlCommandOptions = {}): Promise<DxlStatus[]> {
    const id = options.id ?? this.id;
    const statusCount = options.statusCount ?? defaultStatusCount(id, instruction);
    const timeoutMs = options.timeoutMs ?? 1000;
    const throwErrors = options.throwOnError ?? true;

    return this.transaction(async () => {
      await this.session.write(buildPacket(id, instruction, params, RESERVED_DXL, { byteStuff: options.byteStuff }));
      const statuses: DxlStatus[] = [];
      for (let index = 0; index < statusCount; index++) {
        const status = parseDxlStatusPacket(await this.session.waitForPacket(timeoutMs));
        if (throwErrors) {
          throwOnDxlError(status.error, `instruction 0x${instruction.toString(16).padStart(2, "0")} status from ID ${status.id}`);
        }
        statuses.push(status);
      }
      return statuses;
    });
  }

  async reboot(timeoutMs = 1000): Promise<void> {
    await this.expectOk(Instruction.DxlReboot, new Uint8Array(), "reboot", timeoutMs);
  }

  async bootloaderEntry(timeoutMs = 1000): Promise<void> {
    await this.expectOk(Instruction.DxlBootloaderEntry, new Uint8Array(), "bootloader entry", timeoutMs);
  }

  async action(id = BROADCAST_ID, timeoutMs = 1000): Promise<void> {
    await this.sendInstruction(Instruction.DxlAction, new Uint8Array(), {
      id,
      timeoutMs,
      statusCount: id === BROADCAST_ID ? 0 : 0,
    });
  }

  async factoryReset(option = 0xff, timeoutMs = 1000): Promise<void> {
    await this.expectOk(Instruction.DxlFactoryReset, Uint8Array.from([option & 0xff]), "factory reset", timeoutMs);
  }

  async clearMultiTurn(timeoutMs = 10000): Promise<void> {
    await this.clear(Uint8Array.from([0x01, 0x44, 0x58, 0x4c, 0x22]), timeoutMs);
  }

  async clearError(timeoutMs = 10000): Promise<void> {
    await this.clear(Uint8Array.from([0x02, 0x45, 0x52, 0x43, 0x4c]), timeoutMs);
  }

  async clear(params: Uint8Array, timeoutMs = 10000): Promise<void> {
    await this.expectOk(Instruction.DxlClear, params, "clear", timeoutMs);
  }

  async read(address: number, length: number, timeoutMs = 1000): Promise<Uint8Array> {
    return this.transaction(async () => {
      const params = new Uint8Array(4);
      writeU16LE(params, 0, address);
      writeU16LE(params, 2, length);
      await this.session.write(buildPacket(this.id, Instruction.DxlRead, params, RESERVED_DXL));
      const status = await this.waitForMatchingStatus(timeoutMs, `read ${address}:${length}`, (candidate) =>
        candidate.id === this.id && candidate.data.length === length);
      throwOnDxlError(status.error, `read ${address}:${length}`);
      return status.data.slice();
    });
  }

  async write(address: number, data: Uint8Array, timeoutMs = 1000): Promise<void> {
    await this.expectOk(Instruction.DxlWrite, buildAddressDataParams(address, data), `write ${address}`, timeoutMs);
  }

  async regWrite(address: number, data: Uint8Array, timeoutMs = 1000): Promise<void> {
    await this.expectOk(Instruction.DxlRegWrite, buildAddressDataParams(address, data), `reg write ${address}`, timeoutMs);
  }

  async syncRead(address: number, length: number, ids: number[], timeoutMs = 1000): Promise<DxlStatus[]> {
    const params = new Uint8Array(4 + ids.length);
    writeU16LE(params, 0, address);
    writeU16LE(params, 2, length);
    params.set(ids.map((id) => id & 0xff), 4);
    const statuses = await this.sendInstruction(Instruction.DxlSyncRead, params, {
      id: BROADCAST_ID,
      timeoutMs,
      statusCount: ids.length,
    });
    validateReadStatuses(statuses, length, "sync read");
    return statuses;
  }

  async fastSyncRead(address: number, length: number, ids: number[], timeoutMs = 1000): Promise<DxlStatus[]> {
    const params = new Uint8Array(4 + ids.length);
    writeU16LE(params, 0, address);
    writeU16LE(params, 2, length);
    params.set(ids.map((id) => id & 0xff), 4);
    const statuses = await this.sendInstruction(Instruction.DxlFastSyncRead, params, {
      id: BROADCAST_ID,
      timeoutMs,
      statusCount: 1,
      throwOnError: false,
    });
    const parsed = parseFastReadStatus(statuses[0], ids.map((id) => ({ id, length })), "fast sync read");
    validateReadStatuses(parsed, length, "fast sync read");
    return parsed;
  }

  async syncWrite(address: number, entries: DxlSyncWriteEntry[], dataLength?: number, timeoutMs = 1000): Promise<void> {
    const width = dataLength ?? entries[0]?.data.length ?? 0;
    if (width <= 0) {
      throw new Error("sync write requires a positive data length");
    }
    const params = new Uint8Array(4 + entries.length * (1 + width));
    writeU16LE(params, 0, address);
    writeU16LE(params, 2, width);
    let offset = 4;
    for (const entry of entries) {
      if (entry.data.length !== width) {
        throw new Error(`sync write entry for ID ${entry.id} has ${entry.data.length} bytes, expected ${width}`);
      }
      params[offset++] = entry.id & 0xff;
      params.set(entry.data, offset);
      offset += width;
    }
    await this.sendInstruction(Instruction.DxlSyncWrite, params, {
      id: BROADCAST_ID,
      timeoutMs,
      statusCount: 0,
    });
  }

  async bulkRead(entries: DxlBulkReadEntry[], timeoutMs = 1000): Promise<DxlStatus[]> {
    const params = buildBulkReadParams(entries);
    const statuses = await this.sendInstruction(Instruction.DxlBulkRead, params, {
      id: BROADCAST_ID,
      timeoutMs,
      statusCount: entries.length,
    });
    validateBulkReadStatuses(statuses, entries, "bulk read");
    return statuses;
  }

  async fastBulkRead(entries: DxlBulkReadEntry[], timeoutMs = 1000): Promise<DxlStatus[]> {
    const params = buildBulkReadParams(entries);
    const statuses = await this.sendInstruction(Instruction.DxlFastBulkRead, params, {
      id: BROADCAST_ID,
      timeoutMs,
      statusCount: 1,
      throwOnError: false,
    });
    const parsed = parseFastReadStatus(statuses[0], entries, "fast bulk read");
    validateBulkReadStatuses(parsed, entries, "fast bulk read");
    return parsed;
  }

  async bulkWrite(entries: DxlBulkWriteEntry[], timeoutMs = 1000): Promise<void> {
    let length = 0;
    for (const entry of entries) {
      length += 5 + entry.data.length;
    }
    const params = new Uint8Array(length);
    let offset = 0;
    for (const entry of entries) {
      params[offset++] = entry.id & 0xff;
      writeU16LE(params, offset, entry.address); offset += 2;
      writeU16LE(params, offset, entry.data.length); offset += 2;
      params.set(entry.data, offset);
      offset += entry.data.length;
    }
    await this.sendInstruction(Instruction.DxlBulkWrite, params, {
      id: BROADCAST_ID,
      timeoutMs,
      statusCount: 0,
    });
  }

  async read1(address: number, timeoutMs = 1000): Promise<number> {
    return (await this.read(address, 1, timeoutMs))[0];
  }

  async read2(address: number, timeoutMs = 1000): Promise<number> {
    const data = await this.read(address, 2, timeoutMs);
    return data[0] | (data[1] << 8);
  }

  async read4(address: number, timeoutMs = 1000): Promise<number> {
    return new DataView((await this.read(address, 4, timeoutMs)).buffer).getUint32(0, true);
  }

  async write1(address: number, value: number, timeoutMs = 1000): Promise<void> {
    await this.write(address, Uint8Array.from([value & 0xff]), timeoutMs);
  }

  async write2(address: number, value: number, timeoutMs = 1000): Promise<void> {
    const data = new Uint8Array(2);
    data[0] = value & 0xff;
    data[1] = (value >>> 8) & 0xff;
    await this.write(address, data, timeoutMs);
  }

  async write4(address: number, value: number, timeoutMs = 1000): Promise<void> {
    const data = new Uint8Array(4);
    new DataView(data.buffer).setUint32(0, value >>> 0, true);
    await this.write(address, data, timeoutMs);
  }

  private async expectOk(instruction: number, params: Uint8Array, operation: string, timeoutMs: number): Promise<void> {
    if (this.id === BROADCAST_ID) {
      await this.sendInstruction(instruction, params, {
        timeoutMs,
        statusCount: 0,
      });
      return;
    }

    return this.transaction(async () => {
      await this.session.write(buildPacket(this.id, instruction, params, RESERVED_DXL));
      const status = await this.waitForMatchingStatus(timeoutMs, operation, (candidate) =>
        candidate.id === this.id && candidate.data.length === 0);
      throwOnDxlError(status.error, operation);
    });
  }

  private async waitForMatchingStatus(timeoutMs: number, operation: string, accept: (status: DxlStatus) => boolean): Promise<DxlStatus> {
    const deadline = Date.now() + timeoutMs;
    let lastMismatch: DxlStatus | undefined;

    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        if (lastMismatch) {
          throw new Error(`Dynamixel ${operation} did not receive a matching status before timeout; last status had ${lastMismatch.data.length} bytes`);
        }
        throw new Error("packet timeout");
      }

      const status = parseDxlStatusPacket(await this.session.waitForPacket(remaining));
      if (accept(status)) {
        return status;
      }
      lastMismatch = status;
    }
  }

  private async transaction<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.transactionTail.then(async () => {
      await this.session.flush();
      return operation();
    }, async () => {
      await this.session.flush();
      return operation();
    });
    this.transactionTail = run.catch(() => undefined);
    return run;
  }
}

function defaultStatusCount(id: number, instruction: number): number {
  if (id === BROADCAST_ID ||
      instruction === Instruction.DxlAction ||
      instruction === Instruction.DxlSyncWrite ||
      instruction === Instruction.DxlBulkWrite) {
    return 0;
  }
  return 1;
}

function buildAddressDataParams(address: number, data: Uint8Array): Uint8Array {
  const params = new Uint8Array(2 + data.length);
  writeU16LE(params, 0, address);
  params.set(data, 2);
  return params;
}

function buildBulkReadParams(entries: DxlBulkReadEntry[]): Uint8Array {
  const params = new Uint8Array(entries.length * 5);
  let offset = 0;
  for (const entry of entries) {
    params[offset++] = entry.id & 0xff;
    writeU16LE(params, offset, entry.address); offset += 2;
    writeU16LE(params, offset, entry.length); offset += 2;
  }
  return params;
}

function validateReadStatuses(statuses: DxlStatus[], length: number, operation: string): void {
  for (const status of statuses) {
    if (status.data.length !== length) {
      throw new Error(`Dynamixel ${operation} from ID ${status.id} returned ${status.data.length} bytes, expected ${length}`);
    }
  }
}

function validateBulkReadStatuses(statuses: DxlStatus[], entries: DxlBulkReadEntry[], operation: string): void {
  for (const status of statuses) {
    const entry = entries.find((item) => item.id === status.id);
    if (!entry) {
      throw new Error(`Dynamixel ${operation} returned unexpected ID ${status.id}`);
    }
    if (status.data.length !== entry.length) {
      throw new Error(`Dynamixel ${operation} from ID ${status.id} returned ${status.data.length} bytes, expected ${entry.length}`);
    }
  }
}

function parseFastReadStatus(status: DxlStatus | undefined,
                             entries: Array<{ id: number; length: number }>,
                             operation: string): DxlStatus[] {
  if (status == null) {
    throw new Error(`Dynamixel ${operation} did not return a status packet`);
  }
  if (status.id !== BROADCAST_ID) {
    throw new Error(`Dynamixel ${operation} returned packet ID ${status.id}, expected broadcast ${BROADCAST_ID}`);
  }

  const raw = status.packet;
  let offset = 9;
  const parsed: DxlStatus[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    let error = status.error;
    let id: number;
    if (index === 0) {
      if (offset + 1 + entry.length + 2 > raw.length) {
        throw new Error(`Dynamixel ${operation} response is truncated at first entry`);
      }
      id = raw[offset++];
    } else {
      if (offset + 2 + entry.length + 2 > raw.length) {
        throw new Error(`Dynamixel ${operation} response is truncated at entry ${index}`);
      }
      error = raw[offset++];
      id = raw[offset++];
    }
    if (id !== entry.id) {
      throw new Error(`Dynamixel ${operation} returned ID ${id}, expected ${entry.id}`);
    }
    const data = Uint8Array.from(raw.subarray(offset, offset + entry.length));
    offset += entry.length;
    offset += 2; // Per-device running CRC. The packet CRC was already validated.
    throwOnDxlError(error, `${operation} from ID ${id}`);
    parsed.push({ id, error, data, packet: raw });
  }

  if (offset !== raw.length) {
    throw new Error(`Dynamixel ${operation} parser consumed ${offset} bytes from ${raw.length}`);
  }
  return parsed;
}

function throwOnDxlError(error: number, operation: string): void {
  const instructionError = error & 0x7f;
  if (instructionError !== 0) {
    throw new Error(
      `Dynamixel ${operation} failed: DXL error 0x${instructionError.toString(16).padStart(2, "0")}` +
        (error !== instructionError ? ` (status 0x${error.toString(16).padStart(2, "0")})` : ""),
    );
  }
}
