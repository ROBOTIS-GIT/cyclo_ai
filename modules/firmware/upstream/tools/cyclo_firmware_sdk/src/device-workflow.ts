// SPDX-License-Identifier: Apache-2.0
import type { DynamixelClient } from './dynamixel-client.js';
import type { DxlPingInfo } from './protocol.js';
import { TransportClosureError } from './transport.js';

/** Documented XL330-M288-T map. Never infer a map from a caller's address. */
export const XL330_REGISTERS = {
  returnDelayTime: { address: 9, max: 254, eeprom: true, unit: '2 microseconds' },
  baudRate: { address: 8, max: 6, eeprom: true, unit: 'bits/second' },
  led: { address: 65, max: 1, eeprom: false, unit: 'boolean' },
} as const;
export const XL330_BAUD_RATES = [9600, 57600, 115200, 1000000, 2000000, 3000000, 4000000];
export type RegisterName = keyof typeof XL330_REGISTERS;
export type WorkflowConnection = { dxl: DynamixelClient; close(): Promise<void> };
export type WorkflowConnect = (baud: number) => Promise<WorkflowConnection>;
export type DeviceIntent = { id: number; baud: number; expectedModel?: number; expectedFirmware?: number; changes?: Partial<Record<RegisterName, number>>; timeoutMs?: number };
type ChangeResult = { register: RegisterName; address: number; originalRaw: number; requested: number; requestedRaw: number; status: 'unchanged' | 'unknown' | 'verified' | 'verification_failed'; observedRaw?: number; writeStatusError?: string };
type RecoveryProbe = { baud: number; identity?: DxlPingInfo; registers?: Record<string, number>; error?: string };
type WorkflowResult = {
  outcome: 'verified' | 'read' | 'partial' | 'unknown' | 'not_written';
  baud: number; identity?: DxlPingInfo; snapshot: Record<string, number>;
  changes: ChangeResult[]; recovery: RecoveryProbe[];
  registersBefore?: Record<string, {address: number; raw: number; value?: number; unit: string}>;
  torqueEnabled?: boolean; error?: string; nextAction?: string;
  cleanupErrors?: string[]; recoverySkipped?: string;
};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Operation failed';

export async function deviceWorkflow(connect: WorkflowConnect, intent: DeviceIntent): Promise<WorkflowResult> {
  const timeout = intent.timeoutMs ?? 500;
  if (!Number.isInteger(intent.id) || intent.id < 0 || intent.id > 252 || (intent.expectedModel !== undefined && intent.expectedModel !== 1200)) throw new Error('Only unicast XL330-M288-T model 1200 is supported by this workflow');
  if (!Number.isInteger(intent.baud) || intent.baud < 9600 || intent.baud > 4000000 || !Number.isInteger(timeout) || timeout < 1 || timeout > 2000) throw new Error('Invalid baud or transaction timeout');
  const entries = Object.entries(intent.changes ?? {}) as [RegisterName, number][];
  const desired = entries.map(([name, value]) => {
    if (!Object.hasOwn(XL330_REGISTERS, name)) throw new Error('Unsupported named register');
    const register = XL330_REGISTERS[name];
    const raw = name === 'baudRate' ? XL330_BAUD_RATES.indexOf(value) : value;
    if (!Number.isInteger(raw) || raw < 0 || raw > register.max) throw new Error(`Invalid value for ${name}`);
    return { name, value, raw, ...register };
  }).sort((a, b) => Number(a.name === 'baudRate') - Number(b.name === 'baudRate'));
  let connection: WorkflowConnection | undefined;
  let baud = intent.baud;
  let attempted = false;
  let closureUnconfirmed = false;
  const cleanupErrors: string[] = [];
  const result: WorkflowResult = { outcome: 'not_written', baud, snapshot: {}, changes: [], recovery: [] };
  const close = async () => {
    if (!connection) return true;
    try { await connection.close(); connection = undefined; return true; }
    catch (error) {
      cleanupErrors.push(errorMessage(error));
      closureUnconfirmed = true;
      // A second close may be a false success if the transport lost its handle.
      // Never reopen or probe until process exit guarantees actual descriptor closure.
      return false;
    }
  };
  const checkIdentity = async () => {
    connection!.dxl.setId(intent.id);
    const found = await connection!.dxl.ping(timeout);
    result.identity ??= found;
    if (found.id !== intent.id || found.modelNumber !== (intent.expectedModel ?? 1200) || (intent.expectedFirmware !== undefined && found.firmwareVersion !== intent.expectedFirmware)) throw new Error(`Identity mismatch: expected ID ${intent.id}, model ${intent.expectedModel ?? 1200}, firmware ${intent.expectedFirmware ?? 'any documented version'}; observed ID ${found.id}, model ${found.modelNumber}, firmware ${found.firmwareVersion}. No write is permitted to this identity.`);
    return found;
  };
  const readByte = async (address: number) => {
    const bytes = await connection!.dxl.read(address, 1, timeout);
    if (bytes.length !== 1) throw new Error('Invalid register read length');
    return bytes[0];
  };
  try {
    connection = await connect(baud);
    result.identity = await checkIdentity();
    for (const [name, register] of Object.entries(XL330_REGISTERS)) result.snapshot[name] = await readByte(register.address);
    const torque = await readByte(64);
    result.torqueEnabled = torque !== 0;
    if (desired.some(x => x.eeprom) && torque !== 0) throw new Error('EEPROM configuration requires torque already disabled; torque is never changed automatically');
    for (const change of desired) {
      const row: ChangeResult = { register: change.name, address: change.address, originalRaw: result.snapshot[change.name], requested: change.value, requestedRaw: change.raw, status: 'unchanged' };
      result.changes.push(row);
      if (row.originalRaw === change.raw) continue;
      attempted = true;
      row.status = 'unknown';
      try { await connection.dxl.write(change.address, Uint8Array.of(change.raw), timeout); }
      catch (error) { row.writeStatusError = errorMessage(error); } // Preserve ACK evidence before any reconnect/readback.
      if (change.name === 'baudRate') {
        baud = change.value; // Record the candidate immediately, even if closure fails.
        if (!await close()) throw new Error('Transport closure unconfirmed after baud write; reconnect was not attempted');
        connection = await connect(baud);
        await checkIdentity();
      }
      row.observedRaw = await readByte(change.address);
      row.status = row.observedRaw === change.raw ? 'verified' : 'verification_failed';
      if (row.status !== 'verified') throw new Error('Readback differs from requested value; remaining writes stopped');
    }
    result.outcome = desired.length ? 'verified' : 'read';
    result.registersBefore = Object.fromEntries(Object.entries(XL330_REGISTERS).map(([name, register]) => [name, {address:register.address, raw:result.snapshot[name], value:name === 'baudRate' ? XL330_BAUD_RATES[result.snapshot[name]] : result.snapshot[name], unit:register.unit}]));
  } catch (error) {
    // A failed connector may still own a descriptor even though no connection
    // was returned. Do not turn its cleanup failure into overlapping probes.
    if (error instanceof TransportClosureError) {
      closureUnconfirmed = true;
      cleanupErrors.push(errorMessage(error));
    }
    if (!closureUnconfirmed) await close();
    result.outcome = attempted ? (result.changes.some(x => x.status === 'verified') ? 'partial' : 'unknown') : 'not_written';
    result.error = errorMessage(error);
    result.nextAction = attempted ? 'Use recovery evidence to locate the device and inspect state before any new write. No write was retried or rolled back.' : 'Correct the reported precondition before retrying.';
    if (attempted && !closureUnconfirmed) for (const probeBaud of [...new Set([baud, intent.baud])]) {
      const probe: RecoveryProbe = { baud: probeBaud };
      result.recovery.push(probe);
      try {
        connection = await connect(probeBaud);
        probe.identity = await checkIdentity();
        probe.registers = {};
        for (const change of desired) probe.registers[change.name] = await readByte(change.address);
      } catch (probeError) {
        probe.error = errorMessage(probeError);
        if (probeError instanceof TransportClosureError) {
          closureUnconfirmed = true;
          cleanupErrors.push(errorMessage(probeError));
        }
      }
      finally { if (!closureUnconfirmed) await close(); }
      if (closureUnconfirmed) break;
    }
  } finally { if (!closureUnconfirmed) await close(); }
  result.baud = baud;
  if (closureUnconfirmed) {
    result.cleanupErrors = cleanupErrors;
    result.recoverySkipped = 'Transport closure is unconfirmed; no further session was opened. Wait for the CLI process to exit before read-only probes at original and requested baud.';
    result.error ??= 'Transport closure unconfirmed';
    result.nextAction = result.recoverySkipped;
    if (result.outcome === 'verified') result.outcome = attempted ? 'partial' : 'not_written';
  }
  return result;
}

/** Bounded read-only discovery; preserves completed probes on budget/cancellation. */
export async function scanSerialDevices(connect: WorkflowConnect, ids: number[], bauds: number[], timeoutMs = 100, options: {budgetMs?: number; signal?: AbortSignal; onProgress?: (completed: number, total: number, probe: unknown) => void} = {}) {
  const budget = options.budgetMs ?? 12000;
  if (!ids.length || ids.length > 253 || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || id < 0 || id > 252) || !bauds.length || bauds.length > 7 || new Set(bauds).size !== bauds.length || bauds.some(baud => !Number.isInteger(baud) || baud < 9600 || baud > 4000000) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2000 || !Number.isInteger(budget) || budget < 1 || budget > 12000) throw new Error('Invalid scan IDs, baud rates, timeout or budget (maximum 12000 ms)');
  const probes: unknown[] = [];
  const total = ids.length * bauds.length;
  const deadline = performance.now() + budget;
  let completed = 0, stopped: string | undefined;
  const cancelled = () => options.signal?.aborted ? 'cancelled' : performance.now() + timeoutMs > deadline ? 'budget_exhausted' : undefined;
  for (const baud of bauds) {
    let connection: WorkflowConnection | undefined;
    if ((stopped = cancelled())) break;
    try {
      connection = await connect(baud);
      for (const id of ids) {
        if ((stopped = cancelled())) break;
        connection.dxl.setId(id);
        try { probes.push({ baud, ...await connection.dxl.ping(timeoutMs) }); }
        catch { probes.push({ baud, id, outcome: 'no_valid_response' }); }
        completed++; options.onProgress?.(completed, total, probes[probes.length-1]);
      }
    } catch (error) {
      if (error instanceof TransportClosureError) {
        probes.push({baud,outcome:'connection_failed',ids});
        return { probes, complete: false, completed, total, error: 'Scan stopped because transport closure is unconfirmed', cleanupErrors: [errorMessage(error)] };
      }
      if (!connection) { probes.push({baud,outcome:'connection_failed',ids}); completed += ids.length; try {options.onProgress?.(completed,total,probes[probes.length-1]);} catch(progressError) {stopped='scan_error: '+errorMessage(progressError);} }
      else { stopped = 'scan_error: ' + errorMessage(error); }
    }
    finally {
      try { await connection?.close(); }
      catch (error) { return { probes, complete: false, completed, total, error: 'Scan stopped because transport closure is unconfirmed', cleanupErrors: [errorMessage(error)] }; }
    }
    if (stopped) break;
  }
  return { probes, complete: completed === total, completed, total, stopped, budgetMs: budget, nextAction: stopped ? 'Continue with unprobed IDs/baud rates from the completed probe evidence; no registers were written.' : undefined };
}
