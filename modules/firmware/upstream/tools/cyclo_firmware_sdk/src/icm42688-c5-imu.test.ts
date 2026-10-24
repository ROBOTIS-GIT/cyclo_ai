import assert from "node:assert/strict";

import {
  ICM42688_C5_IMU_CONTROL_TABLE,
  ICM42688_FAST_PACKET_INDIRECT_ADDRESS_BASE,
  ICM42688_FAST_PACKET_INDIRECT_ADDRESSES,
  ICM42688_FAST_PACKET_INDIRECT_DATA_BASE,
  ICM42688_FAST_PACKET_SIZE,
  Icm42688GyroCalibrationResult,
  Icm42688ImuFault,
  Icm42688ImuValidity,
  Icm42688MountAlignmentCommand,
  Icm42688MountAlignmentResult,
  Icm42688MountAlignmentSource,
  Icm42688MountAlignmentState,
  Icm42688MountAlignmentStatus,
  Icm42688ManualTrimCommand,
  Icm42688ManualTrimResult,
  Icm42688ManualTrimState,
  Icm42688ManualTrimStatus,
  decodeIcm42688FastPacket,
  encodeIcm42688FastPacket,
  isIcm42688FastPacketIndirectMap,
  scaleIcm42688FastPacket,
  type Icm42688FastPacket,
} from "./index.js";

assert.deepEqual(
  [
    ICM42688_C5_IMU_CONTROL_TABLE.angularVelocityXQ20,
    ICM42688_C5_IMU_CONTROL_TABLE.angularVelocityYQ20,
    ICM42688_C5_IMU_CONTROL_TABLE.angularVelocityZQ20,
    ICM42688_C5_IMU_CONTROL_TABLE.specificForceXQ20,
    ICM42688_C5_IMU_CONTROL_TABLE.specificForceYQ20,
    ICM42688_C5_IMU_CONTROL_TABLE.specificForceZQ20,
    ICM42688_C5_IMU_CONTROL_TABLE.quaternionWQ30,
    ICM42688_C5_IMU_CONTROL_TABLE.quaternionXQ30,
    ICM42688_C5_IMU_CONTROL_TABLE.quaternionYQ30,
    ICM42688_C5_IMU_CONTROL_TABLE.quaternionZQ30,
  ],
  [84, 88, 92, 96, 100, 104, 108, 112, 116, 120],
);
assert.deepEqual(
  [
    ICM42688_C5_IMU_CONTROL_TABLE.mountRollStagingCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.mountPitchStagingCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.mountAlignmentState,
    ICM42688_C5_IMU_CONTROL_TABLE.mountAlignmentSource,
    ICM42688_C5_IMU_CONTROL_TABLE.mountAlignmentResult,
    ICM42688_C5_IMU_CONTROL_TABLE.mountAlignmentStatus,
    ICM42688_C5_IMU_CONTROL_TABLE.mountAlignmentCommand,
    ICM42688_C5_IMU_CONTROL_TABLE.mountYawStagingCdeg,
  ],
  [184, 186, 188, 189, 190, 192, 193, 194],
);
assert.deepEqual(Icm42688MountAlignmentState, {
  Identity: 0,
  Active: 1,
  Candidate: 2,
  Collecting: 3,
  Rejected: 4,
});
assert.deepEqual(Icm42688MountAlignmentSource, {
  Identity: 0,
  LevelCapture: 1,
  ManualRpy: 2,
  PrecisionLevel: 3,
});
assert.equal(Icm42688MountAlignmentResult.InvalidationFailed, 12);
assert.equal(Icm42688MountAlignmentResult.ImuOffline, 13);
assert.equal(Icm42688MountAlignmentResult.Timeout, 14);
assert.equal(Icm42688MountAlignmentResult.ExcessAngle, 15);
assert.equal(Icm42688MountAlignmentResult.RoleLocked, 16);
assert.equal(Icm42688MountAlignmentStatus.RebootRequired, 1 << 5);
assert.equal(Icm42688MountAlignmentStatus.EepromSaved, 1 << 7);
assert.deepEqual(Icm42688MountAlignmentCommand, {
  None: 0,
  CaptureLevel: 1,
  StageIdentity: 2,
  CheckedSave: 3,
  CheckedClearSaved: 4,
  StageManualRpy: 5,
  BeginPrecisionLevel: 6,
  CaptureNextPose: 7,
  CancelPrecisionLevel: 8,
});
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE.gyroCalibrationResult, 315);
assert.deepEqual(Icm42688GyroCalibrationResult, {
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
});
assert.deepEqual(
  [
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimSchema,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimState,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimResult,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimStatus,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimCommand,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimRollStagingCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimPitchStagingCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimActiveRollCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimActivePitchCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimCandidateRollCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimCandidatePitchCdeg,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimSavedVersion,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimQuaternionWQ30,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimQuaternionXQ30,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimQuaternionYQ30,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimQuaternionZQ30,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimBaseSource,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimGeneration,
    ICM42688_C5_IMU_CONTROL_TABLE.manualTrimDependencyHash,
  ],
  [
    576, 577, 578, 579, 580, 582, 584, 586, 588, 590, 592, 594,
    596, 600, 604, 608, 612, 616, 620,
  ],
);
assert.deepEqual(Icm42688ManualTrimState, {
  Inactive: 0,
  Active: 1,
  Candidate: 2,
  RebootPending: 3,
  Rejected: 4,
});
assert.equal(Icm42688ManualTrimResult.DependencyInvalid, 4);
assert.equal(Icm42688ManualTrimResult.InvalidationFailed, 11);
assert.equal(Icm42688ManualTrimStatus.LoadRejected, 1 << 6);
assert.deepEqual(Icm42688ManualTrimCommand, {
  None: 0,
  Stage: 1,
  CheckedSave: 2,
  CheckedClear: 3,
});

const goldenPacket: Icm42688FastPacket = {
  sequence: 0x0123_4567,
  integrationEndTimeUs: 0x0123_4567_89ab_cdefn,
  integrationDtNs: 0x1020_3040,
  deltaAngleQ30: [0x0102_0304, -2, -0x8000_0000],
  deltaVelocityQ24: [0x7fff_ffff, -0x0102_0304, 0],
  quaternionWbQ30: [0x4000_0000, -0x2000_0000, 0x1234_5678, -1],
  validityFlags:
    Icm42688ImuValidity.RawSample |
    Icm42688ImuValidity.Calibrated |
    Icm42688ImuValidity.Increments |
    Icm42688ImuValidity.Attitude |
    Icm42688ImuValidity.TimeSync |
    Icm42688ImuValidity.YawRelative |
    Icm42688ImuValidity.DeltaAngle |
    Icm42688ImuValidity.DeltaVelocity,
  latchedFaultFlags:
    Icm42688ImuFault.Config |
    Icm42688ImuFault.FifoGap |
    Icm42688ImuFault.Timestamp |
    Icm42688ImuFault.Numerical,
};

const goldenHex =
  "67452301efcdab89674523014030201004030201feffffff00000080" +
  "ffffff7ffcfcfdfe0000000000000040000000e078563412ffffffff" +
  "df01000055000000";

const encoded = encodeIcm42688FastPacket(goldenPacket);
assert.equal(encoded.byteLength, ICM42688_FAST_PACKET_SIZE);
assert.equal(Buffer.from(encoded).toString("hex"), goldenHex);
assert.deepEqual(decodeIcm42688FastPacket(encoded), goldenPacket);
assert.equal(Icm42688ImuValidity.DeltaAngle, 1 << 7);
assert.equal(Icm42688ImuValidity.DeltaVelocity, 1 << 8);
assert.equal(Icm42688ImuValidity.GravityAided, 1 << 9);
assert.equal(Icm42688ImuValidity.AttitudeCoasting, 1 << 10);

const offsetView = new Uint8Array(80);
offsetView.set(encoded, 7);
assert.deepEqual(
  decodeIcm42688FastPacket(offsetView.subarray(7, 71)),
  goldenPacket,
);

assert.deepEqual(ICM42688_FAST_PACKET_INDIRECT_ADDRESSES.slice(0, 40), [
  ...Array.from({ length: 40 }, (_, offset) => 260 + offset),
]);
assert.deepEqual(ICM42688_FAST_PACKET_INDIRECT_ADDRESSES.slice(40, 56), [
  ...Array.from({ length: 16 }, (_, offset) => 108 + offset),
]);
assert.deepEqual(ICM42688_FAST_PACKET_INDIRECT_ADDRESSES.slice(56), [
  ...Array.from({ length: 8 }, (_, offset) => 300 + offset),
]);
assert.equal(ICM42688_FAST_PACKET_INDIRECT_ADDRESS_BASE, 384);
assert.equal(ICM42688_FAST_PACKET_INDIRECT_DATA_BASE, 512);
const canonicalIndirectMap = new Uint8Array(
  ICM42688_FAST_PACKET_INDIRECT_ADDRESSES.length * 2,
);
const canonicalIndirectMapView = new DataView(canonicalIndirectMap.buffer);
ICM42688_FAST_PACKET_INDIRECT_ADDRESSES.forEach((address, index) => {
  canonicalIndirectMapView.setUint16(index * 2, address, true);
});
assert.equal(isIcm42688FastPacketIndirectMap(canonicalIndirectMap), true);
const corruptedIndirectMap = canonicalIndirectMap.slice();
corruptedIndirectMap[17] ^= 0x01;
assert.equal(isIcm42688FastPacketIndirectMap(corruptedIndirectMap), false);
assert.equal(
  isIcm42688FastPacketIndirectMap(canonicalIndirectMap.subarray(0, 127)),
  false,
);

const physical = scaleIcm42688FastPacket(goldenPacket);
assert.equal(physical.integrationDtSeconds, goldenPacket.integrationDtNs * 1e-9);
assert.equal(physical.quaternionWb[0], 1);
assert.equal(physical.quaternionWb[1], -0.5);
assert.equal(physical.deltaVelocityMetersPerSecond[2], 0);

assert.throws(
  () => decodeIcm42688FastPacket(new Uint8Array(63)),
  /must be 64 bytes/,
);
assert.throws(
  () => encodeIcm42688FastPacket({ ...goldenPacket, sequence: -1 }),
  /sequence must be a uint32/,
);
assert.throws(
  () =>
    encodeIcm42688FastPacket({
      ...goldenPacket,
      integrationEndTimeUs: 0x1_0000_0000_0000_0000n,
    }),
  /integrationEndTimeUs must be a uint64 bigint/,
);

console.log("icm42688-c5-imu golden packet tests passed");
