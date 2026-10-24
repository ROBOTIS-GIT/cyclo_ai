// SPDX-License-Identifier: Apache-2.0
import { acquireBusLease } from './bus-lease.mjs';
import { captureJson } from './process.mjs';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import * as z from 'zod/v4';

const integer = (min, max) => z.number().int().min(min).max(max);
const id = integer(0, 252);
const range = { address: integer(0, 65535), length: integer(1, 1024) };
const common = { target: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(), port: z.string().min(1).max(512).optional(), transport: z.enum(['vcp','uart-rs485']).optional(), timeoutMs: integer(10,2000).optional(), dryRun: z.boolean().default(false), baud: integer(9600,4000000).optional() };
const readSchema = z.strictObject({ ...common, id, ...range }).refine(x => x.address + x.length <= 65536, 'Read extends beyond control table');
const names = z.enum(['returnDelayTime', 'baudRate', 'led']);
const changes = z.strictObject({ returnDelayTime: integer(0,254).optional(), baudRate: z.union([z.literal(9600),z.literal(57600),z.literal(115200),z.literal(1000000),z.literal(2000000),z.literal(3000000),z.literal(4000000)]).optional(), led: integer(0,1).optional() }).refine(x => Object.keys(x).length > 0, 'Supply at least one change');
export const definitions = {
  cyclo_serial_ports: { description: 'List OS serial devices, canonical/stable paths, USB identity and permission/transport hints. No port is opened. Use a returned port directly in serial tools; no host target or device declaration is required in local mode.', schema: z.strictObject({}) },
  cyclo_device_state: { description: 'Read XL330-M288-T identity and documented baud, Return Delay Time, LED and torque state in one call. No preliminary ping needed. Select a local port and ID; actual identity and supported register map are checked internally. Restricted targets retain optional expected identity checks.', schema: z.strictObject({ ...common, id }) },
  cyclo_configure: { write: true, description: 'Configure XL330-M288-T named registers in one call: validate host permission and identity, snapshot originals, require torque already off for EEPROM, write once, reconnect after baud changes, and verify readback. Return Delay Time is in 2-microsecond ticks (0–254); baudRate is bits/second; led is 0/1. Failures stop remaining writes and return read-only recovery probes. Never blindly retry unknown/partial results. Set dryRun true for optional planning. No torque/motion/reset/ID writes.', schema: z.strictObject({ ...common, id, changes }) },
  cyclo_serial_scan: { description: 'Scan a local serial port across IDs or an inclusive range (default0–252), at selected bauds (default current baud). Up to253IDs/7bauds, bounded to12seconds; returns completed probes and continuation evidence when budget expires. No register writes. Use timeoutMs to tune probe cost.', schema: z.strictObject({ ...common, ids: z.array(id).min(1).max(253).optional(), minId: id.optional(), maxId: id.optional(), bauds: z.array(integer(9600,4000000)).min(1).max(7).optional(), budgetMs: integer(100,12000).default(12000) }).refine(x => !(x.ids && (x.minId !== undefined || x.maxId !== undefined)) && (!x.ids || new Set(x.ids).size === x.ids.length) && (!x.bauds || new Set(x.bauds).size === x.bauds.length) && (x.minId ?? 0) <= (x.maxId ?? 252), 'Use unique IDs or a valid inclusive range; baud rates must be unique') },
  cyclo_ping: { description: 'Optionally plan or perform a DYNAMIXEL ping against an operator-configured target. No writes.', schema: z.strictObject({ ...common, id }) },
  cyclo_read: { description: 'Optionally plan or read bounded raw control-table bytes. Values are not model-interpreted.', schema: readSchema },
  cyclo_sync_read: { description: 'Optionally plan or read the same bounded register range from 1–16 unique device IDs.', schema: z.strictObject({ ...common, ids: z.array(id).min(1).max(16), ...range }).refine(x => new Set(x.ids).size === x.ids.length && x.address + x.length <= 65536, 'Duplicate IDs or invalid range') },
  cyclo_scan: { description: 'Optionally plan or broadcast ping K1 HAT channels 1–5. Only explicit TCP/UDP channel ports are used; no automatic route configuration.', schema: z.strictObject({ ...common, channels: z.array(integer(1, 5)).min(1).max(5), minId: id.default(0), maxId: id.default(41) }).refine(x => x.minId <= x.maxId && new Set(x.channels).size === x.channels.length, 'Invalid ID range or duplicate channels') },
  cyclo_bridge_profile: { description: 'Optionally plan or read K1 H5 bridge timing counters. Never resets counters.', schema: z.strictObject({ ...common, id }) },
};
const identitySchema = z.object({ id: z.number(), modelNumber: z.number(), firmwareVersion: z.number() });
export const workflowDataSchema = z.object({
  outcome: z.enum(['verified','read','partial','unknown','not_written']),
  identity: identitySchema.optional(),
  baud: z.number().optional(),
  snapshot: z.record(z.string(),z.number()).optional(),
  registersBefore: z.record(z.string(),z.object({address:z.number(),raw:z.number(),value:z.number().optional(),unit:z.string()})).optional(),
  torqueEnabled: z.boolean().optional(),
  changes: z.array(z.object({register:names,address:z.number(),originalRaw:z.number(),requested:z.number(),requestedRaw:z.number(),status:z.enum(['unchanged','unknown','verified','verification_failed']),observedRaw:z.number().optional(),writeStatusError:z.string().optional()})).optional(),
  recovery: z.array(z.object({baud:z.number(),identity:identitySchema.optional(),registers:z.record(z.string(),z.number()).optional(),error:z.string().optional()})).optional(),
  error: z.string().optional(),
  nextAction: z.string().optional(),
  cleanupErrors: z.array(z.string()).optional(),
  recoverySkipped: z.string().optional(),
  processError: z.string().optional(),
});
const targetSchema = z.strictObject({
  transport: z.enum(['vcp', 'uart-rs485', 'tcp', 'udp']),
  host: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/).optional(),
  port: z.string().regex(/^\/(dev|tmp)\/[a-zA-Z0-9_./-]+$/).optional(),
  tcpPort: integer(1, 65535).default(5006),
  baud: integer(9600, 12000000).default(1000000),
  timeoutMs: integer(50, 2000).default(500),
  allowScan: z.boolean().default(false),
  busId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
  devices: z.array(z.strictObject({ id, model: z.literal(1200), firmware: integer(0,255).optional(), writableRegisters: z.array(names).default([]) })).default([]).refine(devices => new Set(devices.map(x => x.id)).size === devices.length, 'Duplicate configured device IDs'),
}).superRefine((x, ctx) => {
  if ((x.transport === 'tcp' || x.transport === 'udp') ? (!x.host || x.port) : (!x.port || x.host)) ctx.addIssue({ code: 'custom', message: 'Configure exactly host for TCP/UDP or port for serial' });
});
export const configSchema = z.preprocess(raw => {
  const value = raw === undefined ? {} : raw;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const legacy = Object.hasOwn(value, 'targets') || Object.hasOwn(value, 'allowHardwareReads');
  return {mode: legacy ? 'restricted' : 'local', ...value};
}, z.strictObject({ mode:z.enum(['local','restricted']), allowHardwareReads:z.boolean().optional(), targets:z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),targetSchema).default({}) })).transform(x => ({...x,allowHardwareReads:x.allowHardwareReads ?? (x.mode === 'local')}));
export async function loadConfig(path) {
  return configSchema.parse(path ? JSON.parse(await readFile(path, 'utf8')) : {});
}
const cliPath = fileURLToPath(new URL('../../cyclo_firmware_cli/dist/cli.js', import.meta.url));
export async function runCli(args, signal, onProgress) {
  const scan = args[0] === 'serial-scan';
  return captureJson(cliPath, args, signal,15000,scan ? 512*1024 : 256*1024,{streamScan:scan,onProgress});
}
export function buildArgs(name, input, target) {
  const transport = ['--transport', target.transport, '--baud', String(input.baud ?? target.baud), '--timeout', String(target.timeoutMs)];
  if (target.host) transport.push('--host', target.host, '--tcp-port', String(target.tcpPort));
  else transport.push('--port', target.port);
  switch (name) {
    case 'cyclo_serial_scan':
      if (!target.allowScan || !['vcp','uart-rs485'].includes(target.transport)) throw new Error('Target does not allow serial scanning');
      const ids = input.ids ?? Array.from({length:(input.maxId ?? 252)-(input.minId ?? 0)+1},(_,i)=>i+(input.minId ?? 0));
      const bauds = input.bauds ?? [input.baud ?? target.baud];
      return ['serial-scan', ...transport, '--ids', ids.join(','), '--bauds', bauds.join(','), '--budget', String(input.budgetMs)];
    case 'cyclo_configure':
    case 'cyclo_device_state': {
      if (!['vcp','uart-rs485'].includes(target.transport)) throw new Error('Documented device workflows require direct serial transport');
      const device = target.devices.find(x => x.id === input.id);
      if (!device && !target.dynamic) throw new Error('Device ID is not in operator configuration. This workflow supports XL330-M288-T model 1200 only; configure the expected model/optional firmware and exact named-register grants on the host.');
      if (name === 'cyclo_configure' && !target.dynamic && Object.keys(input.changes).some(x => !device.writableRegisters.includes(x))) throw new Error('Register write not permitted by operator configuration; allowed registers for this device: ' + (device.writableRegisters.join(', ') || 'none'));
      return ['device-configure', ...transport, '--id', String(input.id), ...(device ? ['--expected-model', String(device.model)] : []), ...(device?.firmware === undefined ? [] : ['--expected-firmware', String(device.firmware)]), '--changes', JSON.stringify(input.changes ?? {})];
    }
    case 'cyclo_ping': return ['dxl-ping', ...transport, '--id', String(input.id)];
    case 'cyclo_read': return ['dxl-read', ...transport, '--id', String(input.id), '--address', String(input.address), '--length', String(input.length)];
    case 'cyclo_sync_read': return ['dxl-sync-read', ...transport, '--ids', input.ids.join(','), '--address', String(input.address), '--length', String(input.length)];
    case 'cyclo_bridge_profile': return ['bridge-profile', ...transport, '--id', String(input.id), '--json'];
    case 'cyclo_scan':
      if (!target.allowScan || !['tcp', 'udp'].includes(target.transport)) throw new Error('Target does not allow K1 HAT channel scanning');
      return ['k1-hat-scan', '--host', target.host, '--protocol', target.transport, '--channels', input.channels.join(','), '--min-id', String(input.minId), '--max-id', String(input.maxId), '--baud', String(input.baud ?? target.baud), '--timeout', String(target.timeoutMs), '--json'];
    default: throw new Error('Unsupported operation');
  }
}
export class Adapter {
  #busy = false;
  constructor(config = {}, runner = runCli, serial = {}) { this.config = configSchema.parse(config); this.runner = runner; this.serial = { list: signal => runCli(['serial-ports'],signal), resolve: (port,signal) => runCli(['serial-resolve','--port',port],signal), ...serial }; }
  capabilities() {
    return { policyMode:this.config.mode, mode: this.config.allowHardwareReads ? 'read-enabled' : 'planning-only', targets: Object.keys(this.config.targets), targetDetails: Object.entries(this.config.targets).map(([name, target]) => ({name, transport:target.transport, baud:target.baud, allowScan:target.allowScan, devices:target.devices,...(target.busId ? {busId:target.busId} : {})})), tools: Object.keys(definitions), unavailable: ['torque control', 'ID changes', 'unmapped register writes', 'bounded motion', 'firmware flashing', 'dataset recording'], contract: 'Existing Cyclo CLI JSON commands; Reads and configured writes execute in one call; dryRun true is optional; local serial ports and IDs are dynamic; restricted mode requires per-device named-register grants; no hardware is touched during planning.' };
  }
  async call(name, raw, signal, onProgress) {
    const definition = definitions[name];
    if (!Object.hasOwn(definitions, name)) throw new Error('Unsupported operation');
    const input = definition.schema.parse(raw);
    if (name === 'cyclo_serial_ports') return {mode:'result',executed:false,data:await this.serial.list(signal)};
    if (!!input.target === !!input.port) throw new Error('Select exactly one port or configured target');
    let target;
    if (input.target) {
      if (!Object.hasOwn(this.config.targets,input.target)) throw new Error('Unknown configured target');
      if (input.transport) throw new Error('Configured target transport cannot be overridden');
      target = {...this.config.targets[input.target]};
    } else {
      if (this.config.mode !== 'local') throw new Error('Dynamic serial selection disabled by restricted host policy; use a configured target');
      const selected = await this.serial.resolve(input.port,signal);
      target = {transport:input.transport ?? 'uart-rs485',port:selected.canonicalPath,baud:input.baud ?? 1000000,timeoutMs:100,allowScan:true,devices:[],dynamic:true,selection:selected.binding,selectedAlias:input.port};
    }
    if (input.timeoutMs !== undefined) target.timeoutMs = input.timeoutMs;
    const args = buildArgs(name, input, target);
    if (input.dryRun) return { mode: 'plan', executed: false, command: 'cyclo-firmware', args };
    if (!this.config.allowHardwareReads) throw new Error('Hardware reads disabled by operator configuration');
    if (signal?.aborted) throw new Error('Request cancelled');
    if (this.#busy) throw new Error('A hardware operation is already in progress; retry after it finishes');
    this.#busy = true;
    let release, outcome, started = false;
    try {
      const reservation = await acquireBusLease(target);
      release = reservation.release;
      await reservation.verify();
      if (reservation.port) args[args.indexOf('--port') + 1] = reservation.port;
      if (signal?.aborted) throw new Error('Request cancelled before execution');
      started = true;
      const data = await this.runner(args, signal, onProgress);
      outcome = { mode: 'result', executed: true, data };
    } catch (error) {
      if (started && name === 'cyclo_serial_scan' && error?.evidence && Array.isArray(error.evidence.probes)) { outcome = {mode:'result',executed:true,data:{...error.evidence,error:error.message ?? 'Scan interrupted'}}; }
      else {
      if (!definition.write || !started) throw error;
      const evidence = workflowDataSchema.safeParse(error && typeof error === 'object' ? error.evidence : undefined);
      const message = error instanceof Error ? error.message : 'Execution failed';
      const data = evidence.success
        ? { ...evidence.data, outcome: evidence.data.outcome === 'verified' ? 'partial' : evidence.data.outcome, error: evidence.data.error ?? message, processError: message }
        : { outcome: 'unknown', error: message, nextAction: 'The process has closed. Read device state at original and requested baud before any new write; no automatic write retry occurred.' };
      outcome = { mode: 'result', executed: true, data };
      }
    }
    finally {
      if (release) { const released = await release(); if (outcome) { outcome.busReservationReleased = released; if (!released) outcome.busReservationWarning = 'Hardware process has closed, but host reservation cleanup failed. Operator must confirm all owners have exited before reservation cleanup.'; } }
      this.#busy = false;
    }
    return outcome;
  }
}
