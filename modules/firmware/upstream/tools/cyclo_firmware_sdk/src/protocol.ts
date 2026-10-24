export const RESERVED_DXL = 0x00;
export const RESERVED_BOOTLOADER = 0x0b;
export const BROADCAST_ID = 0xfe;

export const Instruction = {
  DxlPing: 0x01,
  DxlRead: 0x02,
  DxlWrite: 0x03,
  DxlRegWrite: 0x04,
  DxlAction: 0x05,
  DxlFactoryReset: 0x06,
  DxlReboot: 0x08,
  DxlClear: 0x10,
  DxlBootloaderEntry: 0xa0,
  Info: 0x40,
  Begin: 0x41,
  Write: 0x42,
  Verify: 0x43,
  Commit: 0x44,
  Abort: 0x45,
  RunApp: 0x46,
  Status: 0x55,
  DxlSyncRead: 0x82,
  DxlSyncWrite: 0x83,
  DxlFastSyncRead: 0x8a,
  DxlBulkRead: 0x92,
  DxlBulkWrite: 0x93,
  DxlFastBulkRead: 0x9a,
} as const;

export const BootloaderResultText: Record<number, string> = {
  0x00: "OK",
  0x01: "BAD_PACKET",
  0x02: "BAD_CRC",
  0x03: "BAD_ADDRESS",
  0x04: "BAD_LENGTH",
  0x05: "FLASH_ERROR",
  0x06: "VERIFY_FAILED",
  0x07: "APP_INVALID",
  0x08: "BUSY",
};

export interface ParsedPacket {
  reserved: number;
  id: number;
  instruction: number;
  params: Uint8Array;
}

export interface BootInfo {
  protocolVersion: number;
  bootloaderVersion: number;
  appBase: number;
  appMaxSize: number;
  flashProgramUnit: number;
  preferredChunkSize: number;
  appValid: boolean;
  appSize: number;
  appCrc32: number;
  boardId: string;
}

export interface DxlPingInfo {
  id: number;
  modelNumber: number;
  firmwareVersion: number;
}

export interface DxlStatus {
  id: number;
  error: number;
  data: Uint8Array;
  packet: Uint8Array;
}

export function formatHex(value: number, width = 8): string {
  return `0x${(value >>> 0).toString(16).padStart(width, "0")}`;
}

export function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

export function writeU16LE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
}

export function readU32LE(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}

export function writeU32LE(data: Uint8Array, offset: number, value: number): void {
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint32(offset, value >>> 0, true);
}

export function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (~crc) >>> 0;
}

function byteStuff(body: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < body.length; i++) {
    out.push(body[i]);
    if (i >= 2 && body[i - 2] === 0xff && body[i - 1] === 0xff && body[i] === 0xfd) {
      out.push(0xfd);
    }
  }
  return Uint8Array.from(out);
}

function byteUnstuff(body: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < body.length; i++) {
    out.push(body[i]);
    if (i >= 2 && body[i - 2] === 0xff && body[i - 1] === 0xff && body[i] === 0xfd && body[i + 1] === 0xfd) {
      i++;
    }
  }
  return Uint8Array.from(out);
}

export function buildPacket(
  id: number,
  instruction: number,
  params: Uint8Array<ArrayBufferLike> = new Uint8Array(),
  reserved = RESERVED_DXL,
  options: { byteStuff?: boolean } = {},
): Uint8Array {
  const unstuffedPayload = new Uint8Array(1 + params.length);
  unstuffedPayload[0] = instruction;
  unstuffedPayload.set(params, 1);
  const payload = options.byteStuff === false ? unstuffedPayload : byteStuff(unstuffedPayload);
  const length = payload.length + 2;
  const packet = new Uint8Array(5 + 2 + length);
  packet[0] = 0xff;
  packet[1] = 0xff;
  packet[2] = 0xfd;
  packet[3] = reserved;
  packet[4] = id & 0xff;
  writeU16LE(packet, 5, length);
  packet.set(payload, 7);
  writeU16LE(packet, packet.length - 2, crc16(packet.subarray(0, packet.length - 2)));
  return packet;
}

export function parsePacket(packet: Uint8Array): ParsedPacket {
  if (packet.length < 10 || packet[0] !== 0xff || packet[1] !== 0xff || packet[2] !== 0xfd) {
    throw new Error("bad packet header");
  }
  const length = readU16LE(packet, 5);
  if (packet.length !== 7 + length || length < 3) {
    throw new Error("bad packet length");
  }
  const actual = crc16(packet.subarray(0, packet.length - 2));
  const expected = readU16LE(packet, packet.length - 2);
  if (actual !== expected) {
    throw new Error(`bad packet crc: expected ${formatHex(expected, 4)}, got ${formatHex(actual, 4)}`);
  }

  const payload = byteUnstuff(packet.subarray(7, packet.length - 2));
  if (payload.length < 1) {
    throw new Error("bad packet body");
  }

  return {
    reserved: packet[3],
    id: packet[4],
    instruction: payload[0],
    params: payload.subarray(1),
  };
}

export class PacketStream {
  private buffer: Uint8Array = new Uint8Array();

  push(data: Uint8Array): Uint8Array[] {
    this.buffer = concatBytes(this.buffer, data);
    const packets: Uint8Array[] = [];

    while (this.buffer.length >= 4) {
      const header = indexOfHeader(this.buffer);
      if (header < 0) {
        this.buffer = new Uint8Array();
        break;
      }
      if (header > 0) {
        this.buffer = this.buffer.subarray(header);
      }
      if (this.buffer.length < 7) {
        break;
      }
      const length = readU16LE(this.buffer, 5);
      const total = 7 + length;
      if (length < 3 || total > 4096) {
        this.buffer = this.buffer.subarray(1);
        continue;
      }
      if (this.buffer.length < total) {
        break;
      }
      packets.push(this.buffer.slice(0, total));
      this.buffer = this.buffer.subarray(total);
    }

    return packets;
  }

  clear(): void {
    this.buffer = new Uint8Array();
  }
}

export function parseBootloaderStatus(packet: Uint8Array): { result: number; data: Uint8Array } {
  const parsed = parsePacket(packet);
  if (parsed.reserved !== RESERVED_BOOTLOADER || parsed.instruction !== Instruction.Status) {
    throw new Error("not a bootloader status packet");
  }
  if (parsed.params.length < 1) {
    throw new Error("empty bootloader status packet");
  }
  return { result: parsed.params[0], data: parsed.params.subarray(1) };
}

export function parseDxlStatusPacket(packet: Uint8Array): DxlStatus {
  const parsed = parsePacket(packet);
  if (parsed.reserved !== RESERVED_DXL || parsed.instruction !== Instruction.Status) {
    throw new Error("not a Dynamixel status packet");
  }
  if (parsed.params.length < 1) {
    throw new Error("empty Dynamixel status packet");
  }
  return {
    id: parsed.id,
    error: parsed.params[0],
    data: parsed.params.subarray(1),
    packet,
  };
}

export function parseDxlStatus(packet: Uint8Array): { error: number; data: Uint8Array } {
  const status = parseDxlStatusPacket(packet);
  return { error: status.error, data: status.data };
}

export function parseBootInfo(data: Uint8Array): BootInfo {
  let offset = 0;
  const protocolVersion = data[offset]; offset += 1;
  const bootloaderVersion = readU16LE(data, offset); offset += 2;
  const appBase = readU32LE(data, offset); offset += 4;
  const appMaxSize = readU32LE(data, offset); offset += 4;
  const flashProgramUnit = readU16LE(data, offset); offset += 2;
  const preferredChunkSize = readU16LE(data, offset); offset += 2;
  const appValid = data[offset] === 1; offset += 1;
  const appSize = readU32LE(data, offset); offset += 4;
  const appCrc32 = readU32LE(data, offset); offset += 4;
  const boardLen = data[offset]; offset += 1;
  const boardId = new TextDecoder().decode(data.subarray(offset, offset + boardLen));
  return { protocolVersion, bootloaderVersion, appBase, appMaxSize, flashProgramUnit, preferredChunkSize, appValid, appSize, appCrc32, boardId };
}

export function bootloaderResultName(result: number): string {
  return BootloaderResultText[result] ?? `UNKNOWN_${result}`;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function indexOfHeader(data: Uint8Array): number {
  for (let i = 0; i <= data.length - 3; i++) {
    if (data[i] === 0xff && data[i + 1] === 0xff && data[i + 2] === 0xfd) {
      return i;
    }
  }
  return -1;
}
