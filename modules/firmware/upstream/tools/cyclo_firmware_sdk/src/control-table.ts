import { DynamixelClient } from "./dynamixel-client.js";

export type ControlTableAccess = "r" | "w" | "rw";
export type ControlTableMemory = "eeprom" | "ram";
export type ControlTableValueType = "uint" | "int" | "ascii";

export interface ControlTableItem {
  address: number;
  length: number;
  name: string;
  category: string;
  access: ControlTableAccess;
  memory: ControlTableMemory;
  min?: number;
  max?: number;
  init?: number;
  unit?: string;
  scale?: number;
  labels?: string[];
  ui?: number;
  multi?: boolean;
  valueType: ControlTableValueType;
}

export interface ControlTableCategory {
  name: string;
  items: ControlTableItem[];
}

export interface ControlTableSchema {
  name: string;
  modelNumber: number;
  minimumFirmwareVersion?: number;
  size: number;
  categories: ControlTableCategory[];
  items: ControlTableItem[];
}

export interface ControlTableValue {
  item: ControlTableItem;
  raw: Uint8Array;
  rawHex: string;
  value: number | string | bigint;
  display: string;
  updatedAt: number;
}

export type ControlTableSnapshot = Record<string, ControlTableValue>;

export interface ControlTableLabelOption {
  value: number;
  label: string;
}

export interface ControlTableReadBlock {
  address: number;
  length: number;
}

export interface ControlTableReadOptions {
  maxBlockLength?: number;
}

const CONTROL_TABLE_READ_BLOCK_MAX_LENGTH = 160;

export function isControlTableReadable(item: ControlTableItem): boolean {
  return item.access === "r" || item.access === "rw";
}

export function isControlTableWritable(item: ControlTableItem): boolean {
  return item.access === "w" || item.access === "rw";
}

export function isControlTableCommandItem(item: ControlTableItem): boolean {
  return item.ui === 12 || /command/i.test(item.name);
}

export function isIpv4ControlTableItem(item: ControlTableItem): boolean {
  return item.ui === 21 && item.length === 4 && item.valueType === "uint";
}

export function limitControlTableSchema(schema: ControlTableSchema, size: number): ControlTableSchema {
  const items = schema.items.filter((item) => item.address + item.length <= size);
  const itemAddresses = new Set(items.map((item) => item.address));
  return {
    ...schema,
    size,
    categories: schema.categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => itemAddresses.has(item.address)),
      }))
      .filter((category) => category.items.length > 0),
    items,
  };
}

export function selectControlTableSchemaVariant(
  variants: readonly ControlTableSchema[],
  firmwareVersion?: number,
): ControlTableSchema | null {
  if (variants.length === 0) {
    return null;
  }

  const sorted = [...variants].sort(
    (a, b) => (a.minimumFirmwareVersion ?? 0) - (b.minimumFirmwareVersion ?? 0),
  );

  if (firmwareVersion == null) {
    return sorted[sorted.length - 1] ?? null;
  }

  let selected = sorted[0] ?? null;
  for (const variant of sorted) {
    if ((variant.minimumFirmwareVersion ?? 0) <= firmwareVersion) {
      selected = variant;
    }
  }
  return selected;
}

export function planControlTableReadBlocks(schema: ControlTableSchema, options: ControlTableReadOptions = {}): ControlTableReadBlock[] {
  if (schema.size <= 0 || !schema.items.some(isControlTableReadable)) {
    return [];
  }
  const maxBlockLength = Math.max(1, Math.floor(options.maxBlockLength ?? CONTROL_TABLE_READ_BLOCK_MAX_LENGTH));
  const readable = schema.items.filter(isControlTableReadable);
  const start = Math.min(...readable.map((item) => item.address));
  const end = Math.min(schema.size, Math.max(...readable.map((item) => item.address + item.length)));
  const blocks: ControlTableReadBlock[] = [];
  for (let address = start; address < end; address += maxBlockLength) {
    blocks.push({
      address,
      length: Math.min(maxBlockLength, end - address),
    });
  }
  return blocks;
}

export async function readControlTableSnapshot(
  dxl: DynamixelClient,
  schema: ControlTableSchema,
  timeoutMs = 1000,
  options: ControlTableReadOptions = {},
): Promise<ControlTableSnapshot> {
  const blocks = planControlTableReadBlocks(schema, options);
  const reads: { block: ControlTableReadBlock; data: Uint8Array }[] = [];
  const failures: string[] = [];
  await dxl.session.flush().catch(() => undefined);
  for (const block of blocks) {
    try {
      reads.push({
        block,
        data: await dxl.read(block.address, block.length, timeoutMs),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${block.address}:${block.length} ${message}`);
      await dxl.session.flush().catch(() => undefined);
    }
  }
  if (blocks.length > 0 && reads.length === 0) {
    throw new Error(`control table read failed for all ${blocks.length} block(s): ${failures.join("; ")}`);
  }

  const updatedAt = Date.now();
  const snapshot: ControlTableSnapshot = {};
  for (const item of schema.items) {
    if (!isControlTableReadable(item)) {
      continue;
    }
    const raw = readBytesFromBlocks(reads, item.address, item.length);
    if (!raw) {
      continue;
    }
    snapshot[String(item.address)] = decodeControlTableValue(item, raw, updatedAt);
  }
  return snapshot;
}

function readBytesFromBlocks(
  reads: { block: ControlTableReadBlock; data: Uint8Array }[],
  address: number,
  length: number,
): Uint8Array | undefined {
  const raw = new Uint8Array(length);
  let copied = 0;
  const end = address + length;

  for (const { block, data } of reads) {
    const blockEnd = block.address + block.length;
    const overlapStart = Math.max(address, block.address);
    const overlapEnd = Math.min(end, blockEnd);
    if (overlapStart >= overlapEnd) {
      continue;
    }

    const targetOffset = overlapStart - address;
    const sourceOffset = overlapStart - block.address;
    const count = overlapEnd - overlapStart;
    raw.set(data.subarray(sourceOffset, sourceOffset + count), targetOffset);
    copied += count;
  }

  return copied === length ? raw : undefined;
}

export class ControlTableSnapshotReader {
  private inFlight?: Promise<ControlTableSnapshot>;

  read(
    dxl: DynamixelClient,
    schema: ControlTableSchema,
    timeoutMs = 1000,
    options: ControlTableReadOptions = {},
  ): Promise<ControlTableSnapshot> {
    if (!this.inFlight) {
      this.inFlight = readControlTableSnapshot(dxl, schema, timeoutMs, options).finally(() => {
        this.inFlight = undefined;
      });
    }
    return this.inFlight;
  }
}

export async function writeControlTableItem(
  dxl: DynamixelClient,
  item: ControlTableItem,
  value: string | number | bigint,
  timeoutMs = 1000,
): Promise<void> {
  if (!isControlTableWritable(item)) {
    throw new Error(`${item.name} is not writable`);
  }
  await dxl.write(item.address, encodeControlTableValue(item, value), timeoutMs);
}

export interface ControlTableDecodeOptions {
  rawHex?: boolean;
}

export function decodeControlTableValue(
  item: ControlTableItem,
  raw: Uint8Array,
  updatedAt = Date.now(),
  options: ControlTableDecodeOptions = {},
): ControlTableValue {
  const value = decodeRawValue(item, raw);
  return {
    item,
    raw,
    rawHex: options.rawHex === false ? "" : Array.from(raw).map((byte) => byte.toString(16).padStart(2, "0")).join(" "),
    value,
    display: formatControlTableValue(item, value),
    updatedAt,
  };
}

export function encodeControlTableValue(item: ControlTableItem, value: string | number | bigint): Uint8Array {
  if (item.valueType === "ascii") {
    const data = new Uint8Array(item.length);
    const encoded = new TextEncoder().encode(String(value));
    data.set(encoded.subarray(0, item.length));
    return data;
  }

  if (isIpv4ControlTableItem(item) && typeof value === "string") {
    return encodeIpv4Address(value, item.name);
  }

  if (item.length > 6 && !item.scale) {
    const rawValue = parseExactInteger(value, item.name);
    const bits = BigInt(item.length * 8);
    const signed = item.valueType === "int";
    const min = signed ? -(1n << (bits - 1n)) : 0n;
    const max = signed ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n;
    if (rawValue < min || rawValue > max) {
      throw new Error(`${item.name} must be in [${min}, ${max}]`);
    }
    return encodeBigInteger(rawValue, item.length, signed);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${item.name} value is not a number`);
  }
  const rawValue = item.scale && item.scale !== 0 ? Math.round(numeric / item.scale) : Math.round(numeric);
  const min = controlTableMinValue(item);
  const max = controlTableMaxValue(item);
  if (min !== undefined && rawValue < min) {
    throw new Error(`${item.name} must be >= ${min}`);
  }
  if (max !== undefined && rawValue > max) {
    throw new Error(`${item.name} must be <= ${max}`);
  }
  return encodeInteger(rawValue, item.length, item.valueType === "int");
}

export function formatControlTableValue(item: ControlTableItem, value: number | string | bigint): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "bigint") {
    return item.unit ? `${value} ${item.unit}` : String(value);
  }
  if (isIpv4ControlTableItem(item)) {
    return formatIpv4Address(value);
  }
  if (isFlagControlTableItem(item) && item.labels && item.labels.length > 1) {
    const active = item.labels.filter((_, index) => (value & (1 << index)) !== 0);
    return active.length > 0 ? `${value} (${active.join(", ")})` : `${value}`;
  }
  const label = getControlTableLabelForValue(item, value);
  if (label) {
    return `${value} (${label})`;
  }
  const scaled = formatScaledValue(value, item.scale);
  return item.unit ? `${scaled} ${item.unit}` : scaled;
}

export function formatIpv4Address(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    return "-";
  }
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ].join(".");
}

function encodeIpv4Address(value: string, itemName: string): Uint8Array {
  const parts = value.trim().split(".");
  if (parts.length !== 4) {
    throw new Error(`${itemName} must be an IPv4 address such as 192.168.200.200`);
  }
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      throw new Error(`${itemName} contains an invalid IPv4 octet`);
    }
    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      throw new Error(`${itemName} IPv4 octets must be in [0, 255]`);
    }
    return octet;
  });
  return Uint8Array.from(octets);
}

export function getControlTableLabelOptions(item: ControlTableItem): ControlTableLabelOption[] {
  if (!item.labels || item.labels.length === 0) {
    return [];
  }
  return item.labels.map((label, index) => ({
    value: controlTableLabelValue(item, index),
    label,
  }));
}

function getControlTableLabelForValue(item: ControlTableItem, value: number): string | undefined {
  if (!item.labels || item.labels.length === 0) {
    return undefined;
  }
  const index = controlTableLabelIndex(item, value);
  return index >= 0 && index < item.labels.length ? item.labels[index] : undefined;
}

function controlTableLabelValue(item: ControlTableItem, index: number): number {
  if (labelsCoverInclusiveRange(item)) {
    return (item.min ?? 0) + index;
  }
  return index;
}

function controlTableLabelIndex(item: ControlTableItem, value: number): number {
  if (labelsCoverInclusiveRange(item)) {
    return value - (item.min ?? 0);
  }
  return value;
}

function labelsCoverInclusiveRange(item: ControlTableItem): boolean {
  return !isFlagControlTableItem(item) &&
         item.min !== undefined &&
         item.max !== undefined &&
         item.labels !== undefined &&
         item.labels.length === item.max - item.min + 1;
}

function isFlagControlTableItem(item: ControlTableItem): boolean {
  return item.ui === 8 || item.ui === 9;
}

function controlTableMinValue(item: ControlTableItem): number | undefined {
  return isFlagControlTableItem(item) ? 0 : item.min;
}

function controlTableMaxValue(item: ControlTableItem): number | undefined {
  if (!isFlagControlTableItem(item)) {
    return item.max;
  }
  return 2 ** (item.length * 8) - 1;
}

function formatScaledValue(value: number, scale?: number): string {
  if (!scale) {
    return String(value);
  }
  const scaled = value * scale;
  const decimals = scaleDecimalPlaces(scale);
  return decimals > 0 ? scaled.toFixed(decimals) : String(scaled);
}

function scaleDecimalPlaces(scale: number): number {
  const text = String(scale);
  if (text.includes("e-")) {
    const [, exponent] = text.split("e-");
    return Number(exponent);
  }
  const decimal = text.split(".")[1];
  return decimal ? decimal.length : 0;
}

function decodeRawValue(item: ControlTableItem, raw: Uint8Array): number | string | bigint {
  if (item.valueType === "ascii") {
    const nul = raw.indexOf(0);
    return new TextDecoder().decode(nul >= 0 ? raw.subarray(0, nul) : raw);
  }
  if (raw.length > 6) {
    let value = 0n;
    for (let i = 0; i < raw.length; i++) {
      value |= BigInt(raw[i]) << BigInt(8 * i);
    }
    if (item.valueType === "int") {
      const bits = BigInt(raw.length * 8);
      const sign = 1n << (bits - 1n);
      if ((value & sign) !== 0n) {
        value -= 1n << bits;
      }
    }
    return value;
  }
  let value = 0;
  for (let i = 0; i < raw.length; i++) {
    value += raw[i] * (2 ** (8 * i));
  }
  if (item.valueType === "int") {
    const bits = item.length * 8;
    const sign = 2 ** (bits - 1);
    if (value >= sign) {
      value -= 2 ** bits;
    }
  }
  return value;
}

function encodeInteger(value: number, length: number, signed: boolean): Uint8Array {
  const data = new Uint8Array(length);
  let next = signed && value < 0 ? value + (2 ** (length * 8)) : value;
  for (let i = 0; i < length; i++) {
    data[i] = next & 0xff;
    next = Math.floor(next / 256);
  }
  return data;
}

function parseExactInteger(value: string | number | bigint, itemName: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${itemName} requires a safe integer number, bigint, or integer string`);
    }
    return BigInt(value);
  }
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${itemName} value is not an integer`);
  }
}

function encodeBigInteger(value: bigint, length: number, signed: boolean): Uint8Array {
  const data = new Uint8Array(length);
  let next = signed && value < 0n ? value + (1n << BigInt(length * 8)) : value;
  for (let i = 0; i < length; i++) {
    data[i] = Number(next & 0xffn);
    next >>= 8n;
  }
  return data;
}
