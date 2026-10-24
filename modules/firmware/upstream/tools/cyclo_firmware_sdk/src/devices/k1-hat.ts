// Telemetry snapshot types shared by the K1 HAT dashboard.

export interface K1HatCrsfStatus {
  frameCount: number;
  crcFailCount: number;
  lastFrameAgeMs: number;
  failsafe: boolean;
  rssi1: number;
  rssi2: number;
  linkQuality: number;
  snr: number;
  antenna: number;
  rfMode: number;
  txPower: number;
  downlinkRssi: number;
  downlinkLq: number;
  rxByteCount: number;
  uartErrorCount: number;
}

export interface K1HatHealthStatus {
  dxlRxPacketCount: number;
  dxlTxPacketCount: number;
  dxlRxErrorCount: number;
  uartRxErrorCount: number;
  uartTxErrorCount: number;
  uartRxOverflowCount: number;
  passthroughTarget: number;
  passthroughState: number;
  systemStatusState: number;
  systemStatusFlags: number;
  masterLastPacketAgeMs: number;
  masterTimeoutMs: number;
  realtimeTickMs: number;
  estopActive: boolean;
  fetPwmDuty: number;
  fetPwmStarted: boolean;
  estopPinLevel: number;
  fetSoftStartEnabled: boolean;
  fetSoftStartRampMs: number;
}

export interface K1HatBmsStatus {
  enabled: boolean;
  state: number;
  address: number;
  requestKind1: number;
  requestKind2: number;
  compatFlags: number;
  crsfMirrorEnabled: boolean;
  jrErrorFlags: number;
  baud: number;
  pollPeriodMs: number;
  lastPacketAgeMs: number;
  validMask: number;
  statusFlags: number;
  serviceErrorFlags: number;
  rxByteCount: number;
  txByteCount: number;
  rxFrameCount: number;
  checksumErrorCount: number;
  timeoutCount: number;
  voltageMv: number;
  currentMa: number;
  socPercent: number;
  sohPercent: number;
  temperatureDeciC: number;
  ttfMin: number;
  tteMin: number;
  remainingCapacityMah: number;
  remainingEnergyDeciWh: number;
  reserved3: number;
}

