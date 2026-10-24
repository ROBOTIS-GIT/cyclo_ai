import type { ControlTableSnapshot } from "../control-table.js";
export const K1_DUAL_REMOTE_MIN_FW = 39;
export const K1_REMOTE_BASES = [1632, 1728] as const;
export type K1RemoteLinkState = "Disabled" | "Initialization failed" | "Unavailable" | "Waiting" | "Stale" | "Suspended" | "No Signal" | "Failsafe" | "Connected";
export interface K1RemoteStatus {
  source: 1 | 2;
  linkState: K1RemoteLinkState;
  valid: boolean;
  ageMs: number | null;
  frames: number | null;
  crcErrors: number | null;
  uartErrors: number | null;
  overflows: number | null;
  linkQuality: number | null;
  rssi1: number | null;
  rssi2: number | null;
  requestedMode: string;
  apiRequested: boolean | null;
  mimicSlot: number | null;
  channels: (number | null)[];
}
export interface K1Remote2Configuration {
  supported: boolean;
  fresh: boolean;
  requested: boolean | null;
  applied: boolean | null;
  driverState: number | null;
  saveState: number | null;
  saved: boolean | null;
  rebootRequired: boolean | null;
  canReboot: boolean;
}
export interface K1DualRemoteStatus {
  remote2Config: K1Remote2Configuration | null;
  supported: boolean;
  rawOnly: boolean;
  interfaceVersion: number | null;
  controlFresh: boolean;
  source: string;
  controlMode: string;
  groupEnabled: boolean | null;
  blockReason: string;
  stopSources: string[] | null;
  executionState: string;
  ledHint: number | null;
  remotes: K1RemoteStatus[];
}
export function readK1DualRemoteStatus(snapshot: ControlTableSnapshot, firmwareVersion: number,
                                      connected: boolean, now = Date.now()): K1DualRemoteStatus {
  const number = (address: number): number | null => {
    const value = snapshot[String(address)]?.value;
    return typeof value === "number" ? value : null;
  };
  const fresh = (address: number) => {
    const sample = snapshot[String(address)];
    return connected && sample != null && now >= sample.updatedAt && now - sample.updatedAt <= 1500;
  };
  const supported = firmwareVersion >= K1_DUAL_REMOTE_MIN_FW;
  const rawOnly = true;
  const interfaceVersion = fresh(1600) ? number(1600) : null;
  const controlFresh = supported && interfaceVersion === 2 && fresh(1602) && fresh(1608);
  const stop = number(1608);
  const configSupported = supported && controlFresh && ((number(1602) ?? 0) & 16) !== 0;
  const configFresh = configSupported && [1856,1857,1858,1859,1860,1861].every(fresh);
  const configBool = (address: number) => configFresh && [0,1].includes(number(address) ?? -1) ? number(address) === 1 : null;
  const requested = configBool(1856), applied = configBool(1857), saved = configBool(1860);
  const saveState = configFresh ? number(1859) : null;
  const driverState = configFresh ? number(1858) : null;
  const rebootRequired = configBool(1861);
  const remote2Config: K1Remote2Configuration | null = !supported ? null : {
    supported: configSupported, fresh: configFresh, requested, applied, saved, saveState, driverState, rebootRequired,
    canReboot: configFresh && saveState === 1 && saved !== null && saved === requested && rebootRequired === true,
  };
  return {
    supported, rawOnly, interfaceVersion, controlFresh, remote2Config,
    source: "Managed by sim2real",
    controlMode: "Raw receiver monitoring",
    groupEnabled: null,
    blockReason: "Managed by sim2real",
    stopSources: controlFresh && stop != null
      ? ["Physical", "Remote 1"].filter((_, i) => (stop & (1 << i)) !== 0) : null,
    executionState: "Not reported by HAT",
    ledHint: null,
    remotes: supported ? K1_REMOTE_BASES.map((base, i): K1RemoteStatus => {
      const flags = number(base), ageMs = number(base + 2);
      const configured = i === 1 && remote2Config != null;
      const required = [base, base + 2, base + 4, base + 80,
        ...Array.from({ length: 16 }, (_, ch) => base + 36 + ch * 2)];
      const batchTime = snapshot[String(base)]?.updatedAt;
      const current = (!configured || configFresh) && interfaceVersion === 2 &&
        required.every(address => fresh(address) && snapshot[String(address)].updatedAt === batchTime);
      const driverReady = !configured || (applied === true && driverState === 1);
      const valid = current && driverReady && flags != null && (flags & 4) !== 0 && ageMs != null && ageMs <= 100;
      const linkFields = [base + 24, ...Array.from({ length: 10 }, (_, j) => base + 26 + j)];
      const linkAge = number(base + 24);
      const linkValid = current && driverReady && flags != null && (flags & 16) !== 0 &&
        linkAge != null && linkAge <= 1000 && linkFields.every(address =>
          fresh(address) && snapshot[String(address)].updatedAt === batchTime);
      return {
        source: (i + 1) as 1 | 2,
        linkState: flags == null ? "Waiting" : !current ? "Stale" :
          configured && applied === false && driverState === 0 ? "Disabled" :
          configured && driverState === 2 ? firmwareVersion >= 40 ? "Unavailable" : "Initialization failed" : !(flags & 1) ? "Suspended" :
          !(flags & 2) ? "No Signal" : !valid ? "Failsafe" : "Connected",
        valid, ageMs,
        frames: number(base + 4), crcErrors: number(base + 8), uartErrors: number(base + 16), overflows: number(base + 20),
        linkQuality: linkValid ? number(base + 28) : null,
        rssi1: linkValid && number(base + 26) != null ? -number(base + 26)! : null,
        rssi2: linkValid && number(base + 27) != null ? -number(base + 27)! : null,
        requestedMode: "Not interpreted",
        apiRequested: null,
        mimicSlot: null,
        channels: Array.from({ length: 16 }, (_, ch) => number(base + 36 + ch * 2)),
      };
    }) : [],
  };
}
