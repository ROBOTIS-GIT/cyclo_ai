export const ICM42688_C5_IMU_CONTROL_TABLE = {
  angularVelocityXQ20: 84,
  angularVelocityYQ20: 88,
  angularVelocityZQ20: 92,
  specificForceXQ20: 96,
  specificForceYQ20: 100,
  specificForceZQ20: 104,
  quaternionWQ30: 108,
  quaternionXQ30: 112,
  quaternionYQ30: 116,
  quaternionZQ30: 120,
  mountRollStagingCdeg: 184,
  mountPitchStagingCdeg: 186,
  mountAlignmentState: 188,
  mountAlignmentSource: 189,
  mountAlignmentResult: 190,
  mountAlignmentStatus: 192,
  mountAlignmentCommand: 193,
  mountYawStagingCdeg: 194,
  imuSequence: 260,
  integrationEndTimeUs: 264,
  integrationDtNs: 272,
  deltaAngleXQ30: 276,
  deltaAngleYQ30: 280,
  deltaAngleZQ30: 284,
  deltaVelocityXQ24: 288,
  deltaVelocityYQ24: 292,
  deltaVelocityZQ24: 296,
  validityFlags: 300,
  latchedFaultFlags: 304,
  calibrationGeneration: 308,
  profileId: 312,
  estimatorMode: 314,
  gyroCalibrationResult: 315,
  /** @deprecated Address 315 is Gyro Calibration Result on firmware v49+. */
  productionReserved: 315,
  precisionLevelSchema: 316,
  precisionLevelState: 317,
  precisionLevelExpectedPose: 318,
  precisionLevelCapturedMask: 319,
  precisionLevelSession: 320,
  precisionLevelCalibrationGeneration: 324,
  precisionLevelResetGeneration: 328,
  precisionLevelEstimatorGeneration: 332,
  precisionLevelYaw0Cdeg: 336,
  precisionLevelYaw90Cdeg: 338,
  precisionLevelYaw180Cdeg: 340,
  precisionLevelYaw270Cdeg: 342,
  precisionLevelYaw360Cdeg: 344,
  precisionLevelTableRollCdeg: 346,
  precisionLevelTablePitchCdeg: 348,
  precisionLevelClosureMdeg: 350,
  precisionLevelPairAxisMdeg: 352,
  precisionLevelPairSlopeMdeg: 354,
  precisionLevelMaxYawErrorCdeg: 356,
  precisionLevelCandidateTiltCdeg: 358,
  precisionLevelAcceptedSamples: 360,
  precisionLevelRejectedSamples: 364,
  precisionLevelRestartCount: 368,
  precisionLevelRejectionFlags: 372,
  precisionLevelSolverFlags: 376,
  manualTrimSchema: 576,
  manualTrimState: 577,
  manualTrimResult: 578,
  manualTrimStatus: 579,
  manualTrimCommand: 580,
  manualTrimRollStagingCdeg: 582,
  manualTrimPitchStagingCdeg: 584,
  manualTrimActiveRollCdeg: 586,
  manualTrimActivePitchCdeg: 588,
  manualTrimCandidateRollCdeg: 590,
  manualTrimCandidatePitchCdeg: 592,
  manualTrimSavedVersion: 594,
  manualTrimQuaternionWQ30: 596,
  manualTrimQuaternionXQ30: 600,
  manualTrimQuaternionYQ30: 604,
  manualTrimQuaternionZQ30: 608,
  manualTrimBaseSource: 612,
  manualTrimGeneration: 616,
  manualTrimDependencyHash: 620,
} as const;

export const ICM42688_MOUNT_ALIGNMENT_MINIMUM_FIRMWARE_VERSION = 48;
export const ICM42688_GYRO_CAL_RESULT_MINIMUM_FIRMWARE_VERSION = 49;
export const ICM42688_PRECISION_LEVEL_MINIMUM_FIRMWARE_VERSION = 50;
export const ICM42688_MANUAL_TRIM_MINIMUM_FIRMWARE_VERSION = 51;

export const Icm42688GyroCalibrationResult = {
  None: 0,
  Ok: 1,
  PreconditionRejected: 2,
  PersistenceNotReady: 3,
  InvalidRecord: 4,
  WriteFailed: 5,
  ReadbackFailed: 6,
  LengthMismatch: 7,
  SemanticInvalid: 8,
  DataMismatch: 9,
  InvalidationFailed: 10,
} as const;

export type Icm42688GyroCalibrationResultId =
  (typeof Icm42688GyroCalibrationResult)[keyof typeof Icm42688GyroCalibrationResult];

export const Icm42688MountAlignmentState = {
  Identity: 0,
  Active: 1,
  Candidate: 2,
  Collecting: 3,
  Rejected: 4,
} as const;

export type Icm42688MountAlignmentStateId =
  (typeof Icm42688MountAlignmentState)[keyof typeof Icm42688MountAlignmentState];

export const Icm42688MountAlignmentSource = {
  Identity: 0,
  LevelCapture: 1,
  ManualRpy: 2,
  PrecisionLevel: 3,
} as const;

export type Icm42688MountAlignmentSourceId =
  (typeof Icm42688MountAlignmentSource)[keyof typeof Icm42688MountAlignmentSource];

export const Icm42688MountAlignmentResult = {
  None: 0,
  Ok: 1,
  MotionRejected: 2,
  PrerequisiteInvalid: 3,
  DependencyInvalid: 4,
  InvalidCandidate: 5,
  PersistenceNotReady: 6,
  WriteFailed: 7,
  ReadbackFailed: 8,
  LengthMismatch: 9,
  SemanticInvalid: 10,
  DataMismatch: 11,
  InvalidationFailed: 12,
  ImuOffline: 13,
  Timeout: 14,
  ExcessAngle: 15,
  RoleLocked: 16,
  WrongPose: 17,
  YawContinuityLost: 18,
  ClosureMismatch: 19,
  PairMismatch: 20,
  SurfaceTiltExcessive: 21,
  SessionGenerationChanged: 22,
  SolutionRejected: 23,
} as const;

export type Icm42688MountAlignmentResultId =
  (typeof Icm42688MountAlignmentResult)[keyof typeof Icm42688MountAlignmentResult];

export const Icm42688MountAlignmentStatus = {
  ActiveValid: 1 << 0,
  Collecting: 1 << 1,
  MotionReject: 1 << 2,
  PrerequisiteInvalid: 1 << 3,
  DependencyInvalid: 1 << 4,
  RebootRequired: 1 << 5,
  SaveError: 1 << 6,
  EepromSaved: 1 << 7,
} as const;

export const Icm42688MountAlignmentCommand = {
  None: 0,
  CaptureLevel: 1,
  StageIdentity: 2,
  CheckedSave: 3,
  CheckedClearSaved: 4,
  StageManualRpy: 5,
  BeginPrecisionLevel: 6,
  CaptureNextPose: 7,
  CancelPrecisionLevel: 8,
} as const;

export const Icm42688ManualTrimState = {
  Inactive: 0,
  Active: 1,
  Candidate: 2,
  RebootPending: 3,
  Rejected: 4,
} as const;

export const Icm42688ManualTrimResult = {
  None: 0,
  Ok: 1,
  InvalidCandidate: 2,
  BaseRebootPending: 3,
  DependencyInvalid: 4,
  PersistenceNotReady: 5,
  WriteFailed: 6,
  ReadbackFailed: 7,
  LengthMismatch: 8,
  SemanticInvalid: 9,
  DataMismatch: 10,
  InvalidationFailed: 11,
} as const;

export const Icm42688ManualTrimStatus = {
  ActiveValid: 1 << 0,
  CandidateValid: 1 << 1,
  EepromSaved: 1 << 2,
  RebootRequired: 1 << 3,
  DependencyInvalid: 1 << 4,
  SaveError: 1 << 5,
  LoadRejected: 1 << 6,
} as const;

export const Icm42688ManualTrimCommand = {
  None: 0,
  Stage: 1,
  CheckedSave: 2,
  CheckedClear: 3,
} as const;

export const Icm42688PrecisionLevelState = {
  Idle: 0,
  WaitPose: 1,
  WaitStationary: 2,
  Averaging: 3,
  Solving: 4,
  Candidate: 5,
  Rejected: 6,
} as const;

export const Icm42688PrecisionLevelExpectedPose = {
  Zero: 0,
  Quarter: 1,
  Half: 2,
  ThreeQuarter: 3,
  Closure: 4,
  None: 255,
} as const;

export const Icm42688PrecisionLevelRejection = {
  WrongPose: 1 << 0,
  YawContinuity: 1 << 1,
  Closure: 1 << 2,
  PairAxis: 1 << 3,
  PairSlope: 1 << 4,
  SurfaceTilt: 1 << 5,
  Generation: 1 << 6,
  Source: 1 << 7,
  Timeout: 1 << 8,
  Solver: 1 << 9,
} as const;

export const Icm42688PrecisionLevelSolver = {
  EqualWeighted: 1 << 0,
  YawPreserved: 1 << 1,
  Reversal: 1 << 2,
} as const;

export const Icm42688ImuValidity = {
  RawSample: 1 << 0,
  Calibrated: 1 << 1,
  Increments: 1 << 2,
  Attitude: 1 << 3,
  TimeSync: 1 << 4,
  Temperature: 1 << 5,
  YawRelative: 1 << 6,
  DeltaAngle: 1 << 7,
  DeltaVelocity: 1 << 8,
  GravityAided: 1 << 9,
  AttitudeCoasting: 1 << 10,
} as const;

export const Icm42688ImuFault = {
  Config: 1 << 0,
  SpiTransfer: 1 << 1,
  FifoGap: 1 << 2,
  FifoOverflow: 1 << 3,
  Timestamp: 1 << 4,
  Clipping: 1 << 5,
  Numerical: 1 << 6,
  Calibration: 1 << 7,
} as const;

export const Icm42688ImuProfile = {
  Production1KHz: 0,
  Characterization2KHz: 1,
  Characterization4KHz: 2,
  Lab8KHz: 3,
} as const;

export type Icm42688ImuProfileId =
  (typeof Icm42688ImuProfile)[keyof typeof Icm42688ImuProfile];

export const Icm42688EstimatorMode = {
  Invalid: 0,
  MadgwickRegression: 1,
  Vqf6D: 2,
} as const;

export type Icm42688EstimatorModeId =
  (typeof Icm42688EstimatorMode)[keyof typeof Icm42688EstimatorMode];

export const ICM42688_FAST_PACKET_SIZE = 64;
export const ICM42688_FAST_PACKET_INDIRECT_ADDRESS_BASE = 384;
export const ICM42688_FAST_PACKET_INDIRECT_DATA_BASE = 512;

export const ICM42688_FAST_PACKET_OFFSETS = {
  sequence: 0,
  integrationEndTimeUs: 4,
  integrationDtNs: 12,
  deltaAngleQ30: 16,
  deltaVelocityQ24: 28,
  quaternionWbQ30: 40,
  validityFlags: 56,
  latchedFaultFlags: 60,
} as const;

/**
 * Source control-table address for every byte in the canonical 64-byte
 * indirect-data packet. Program Indirect Address 1..64 with this sequence.
 */
export const ICM42688_FAST_PACKET_INDIRECT_ADDRESSES: readonly number[] = Object.freeze([
  ...addressRange(ICM42688_C5_IMU_CONTROL_TABLE.imuSequence, 40),
  ...addressRange(ICM42688_C5_IMU_CONTROL_TABLE.quaternionWQ30, 16),
  ...addressRange(ICM42688_C5_IMU_CONTROL_TABLE.validityFlags, 8),
]);

/**
 * Validate the complete little-endian Indirect Address 1..64 table before
 * interpreting Indirect Data 1..64 as an ICM42688 fast packet.
 */
export function isIcm42688FastPacketIndirectMap(data: Uint8Array): boolean {
  if (data.byteLength !== ICM42688_FAST_PACKET_SIZE * 2) {
    return false;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return ICM42688_FAST_PACKET_INDIRECT_ADDRESSES.every(
    (address, index) => view.getUint16(index * 2, true) === address,
  );
}

export type Icm42688Vector3Q = readonly [number, number, number];
export type Icm42688QuaternionQ30 = readonly [number, number, number, number];

/**
 * Exact wire representation of the canonical controller packet.
 *
 * - quaternionWbQ30 is scalar-first Hamilton q_WB (body FLU to world ENU).
 * - deltaAngleQ30 is a body-FLU vector in radians.
 * - deltaVelocityQ24 is a body-FLU vector in m/s and contains no claimed
 *   sculling compensation.
 * - All three fields already include the firmware's fixed sensor-to-board
 *   transform and active board-to-robot mount alignment; consumers must not
 *   apply either transform again.
 * - integrationEndTimeUs is bigint so the uint64 timestamp is never rounded.
 */
export interface Icm42688FastPacket {
  sequence: number;
  integrationEndTimeUs: bigint;
  integrationDtNs: number;
  deltaAngleQ30: Icm42688Vector3Q;
  deltaVelocityQ24: Icm42688Vector3Q;
  quaternionWbQ30: Icm42688QuaternionQ30;
  validityFlags: number;
  latchedFaultFlags: number;
}

export interface Icm42688FastPacketPhysical {
  sequence: number;
  integrationEndTimeUs: bigint;
  integrationDtSeconds: number;
  deltaAngleRad: readonly [number, number, number];
  deltaVelocityMetersPerSecond: readonly [number, number, number];
  quaternionWb: readonly [number, number, number, number];
  validityFlags: number;
  latchedFaultFlags: number;
}

export function encodeIcm42688FastPacket(packet: Icm42688FastPacket): Uint8Array {
  assertUint32(packet.sequence, "sequence");
  assertUint64(packet.integrationEndTimeUs, "integrationEndTimeUs");
  assertUint32(packet.integrationDtNs, "integrationDtNs");
  assertInt32Tuple(packet.deltaAngleQ30, 3, "deltaAngleQ30");
  assertInt32Tuple(packet.deltaVelocityQ24, 3, "deltaVelocityQ24");
  assertInt32Tuple(packet.quaternionWbQ30, 4, "quaternionWbQ30");
  assertUint32(packet.validityFlags, "validityFlags");
  assertUint32(packet.latchedFaultFlags, "latchedFaultFlags");

  const data = new Uint8Array(ICM42688_FAST_PACKET_SIZE);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  view.setUint32(ICM42688_FAST_PACKET_OFFSETS.sequence, packet.sequence, true);
  view.setBigUint64(
    ICM42688_FAST_PACKET_OFFSETS.integrationEndTimeUs,
    packet.integrationEndTimeUs,
    true,
  );
  view.setUint32(ICM42688_FAST_PACKET_OFFSETS.integrationDtNs, packet.integrationDtNs, true);
  writeInt32Tuple(view, ICM42688_FAST_PACKET_OFFSETS.deltaAngleQ30, packet.deltaAngleQ30);
  writeInt32Tuple(view, ICM42688_FAST_PACKET_OFFSETS.deltaVelocityQ24, packet.deltaVelocityQ24);
  writeInt32Tuple(view, ICM42688_FAST_PACKET_OFFSETS.quaternionWbQ30, packet.quaternionWbQ30);
  view.setUint32(ICM42688_FAST_PACKET_OFFSETS.validityFlags, packet.validityFlags, true);
  view.setUint32(
    ICM42688_FAST_PACKET_OFFSETS.latchedFaultFlags,
    packet.latchedFaultFlags,
    true,
  );
  return data;
}

export function decodeIcm42688FastPacket(data: Uint8Array): Icm42688FastPacket {
  if (data.byteLength !== ICM42688_FAST_PACKET_SIZE) {
    throw new Error(
      `ICM42688 fast packet must be ${ICM42688_FAST_PACKET_SIZE} bytes, got ${data.byteLength}`,
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    sequence: view.getUint32(ICM42688_FAST_PACKET_OFFSETS.sequence, true),
    integrationEndTimeUs: view.getBigUint64(
      ICM42688_FAST_PACKET_OFFSETS.integrationEndTimeUs,
      true,
    ),
    integrationDtNs: view.getUint32(ICM42688_FAST_PACKET_OFFSETS.integrationDtNs, true),
    deltaAngleQ30: readInt32Tuple3(view, ICM42688_FAST_PACKET_OFFSETS.deltaAngleQ30),
    deltaVelocityQ24: readInt32Tuple3(
      view,
      ICM42688_FAST_PACKET_OFFSETS.deltaVelocityQ24,
    ),
    quaternionWbQ30: readInt32Tuple4(
      view,
      ICM42688_FAST_PACKET_OFFSETS.quaternionWbQ30,
    ),
    validityFlags: view.getUint32(ICM42688_FAST_PACKET_OFFSETS.validityFlags, true),
    latchedFaultFlags: view.getUint32(
      ICM42688_FAST_PACKET_OFFSETS.latchedFaultFlags,
      true,
    ),
  };
}

export function scaleIcm42688FastPacket(
  packet: Icm42688FastPacket,
): Icm42688FastPacketPhysical {
  const q30 = 2 ** -30;
  const q24 = 2 ** -24;
  return {
    sequence: packet.sequence,
    integrationEndTimeUs: packet.integrationEndTimeUs,
    integrationDtSeconds: packet.integrationDtNs * 1e-9,
    deltaAngleRad: packet.deltaAngleQ30.map((value) => value * q30) as [
      number,
      number,
      number,
    ],
    deltaVelocityMetersPerSecond: packet.deltaVelocityQ24.map(
      (value) => value * q24,
    ) as [number, number, number],
    quaternionWb: packet.quaternionWbQ30.map((value) => value * q30) as [
      number,
      number,
      number,
      number,
    ],
    validityFlags: packet.validityFlags,
    latchedFaultFlags: packet.latchedFaultFlags,
  };
}

function addressRange(start: number, length: number): number[] {
  return Array.from({ length }, (_, offset) => start + offset);
}

function writeInt32Tuple(
  view: DataView,
  offset: number,
  values: readonly number[],
): void {
  values.forEach((value, index) => view.setInt32(offset + index * 4, value, true));
}

function readInt32Tuple3(view: DataView, offset: number): [number, number, number] {
  return [
    view.getInt32(offset, true),
    view.getInt32(offset + 4, true),
    view.getInt32(offset + 8, true),
  ];
}

function readInt32Tuple4(
  view: DataView,
  offset: number,
): [number, number, number, number] {
  return [
    view.getInt32(offset, true),
    view.getInt32(offset + 4, true),
    view.getInt32(offset + 8, true),
    view.getInt32(offset + 12, true),
  ];
}

function assertUint32(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`${name} must be a uint32`);
  }
}

function assertUint64(value: bigint, name: string): void {
  if (typeof value !== "bigint" || value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new Error(`${name} must be a uint64 bigint`);
  }
}

function assertInt32Tuple(
  values: readonly number[],
  expectedLength: number,
  name: string,
): void {
  if (values.length !== expectedLength) {
    throw new Error(`${name} must contain ${expectedLength} values`);
  }
  values.forEach((value, index) => {
    if (!Number.isInteger(value) || value < -0x8000_0000 || value > 0x7fff_ffff) {
      throw new Error(`${name}[${index}] must be an int32`);
    }
  });
}
