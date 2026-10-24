import assert from "node:assert/strict";

import {
  assertIcmImuBuildManifestMatchesBoard,
  parseIcmImuBuildManifest,
} from "./imu-build-manifest.js";

const MAGIC = 0x494d554d;
const SCHEMA_VERSION = 5;
const STRUCT_SIZE = 432;
const VQF_FIXED_DEFAULT_1KHZ_FLAG = 1 << 7;
const SENSOR_CLKIN_32000HZ_FLAG = 1 << 8;
const HANDOFF_DIAGNOSTICS_V2_FLAG = 1 << 11;
const LAB_ONLY_FLAG = 1 << 2;
const ANALYSIS_ONLY_NOT_FLASHABLE_FLAG = 1 << 5;
const DEPLOYABLE_CHARACTERIZATION_FLAG = 1 << 6;
const DXL_CRC_STRICT_HW_FLAG = 1 << 12;
const STM32C5_CORDIC_MATH_FLAG = 1 << 13;
const STM32C5_CORDIC_HIL_FLAG = 1 << 14;
const MOUNT_ALIGNMENT_WORKFLOW_FLAG = 1 << 15;
const SENSOR_TO_BODY_TRANSFORM_ID_OFFSET = 44;
const SENSOR_ODR_HZ_OFFSET = 16;
const OUTPUT_RATE_HZ_OFFSET = 20;
const BOARD_PROFILE_NAME_OFFSET = 88;
const BOARD_PROFILE_NAME_SIZE = 24;
const SENSOR_TO_BODY_TRANSFORM_NAME_OFFSET = 112;
const SENSOR_TO_BODY_TRANSFORM_NAME_SIZE = 32;
const SENSOR_TO_BODY_QUALIFICATION_OFFSET = 144;
const SENSOR_TO_BODY_QUALIFICATION_SIZE = 24;
const RESERVED1_OFFSET = 419;
const SENSOR_TO_BODY_OFFSET = 420;
const RESERVED2_OFFSET = 429;

type SensorToBodyMatrix = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const REV03_SENSOR_TO_BODY: SensorToBodyMatrix = [
  [0, 0, -1],
  [0, 1, 0],
  [1, 0, 0],
];
const REV05_SENSOR_TO_BODY: SensorToBodyMatrix = [
  [0, 0, -1],
  [-1, 0, 0],
  [0, 1, 0],
];

interface ManifestFixtureOptions {
  offset?: number;
  schemaVersion?: number;
  structSize?: number;
  flags?: number;
  sensorOdrHz?: number;
  outputRateHz?: number;
  boardProfileId?: number;
  boardProfileName?: string;
  boardInterruptCount?: number;
  reserved0?: number;
  sensorToBodyTransformId?: number;
  sensorToBodyTransformName?: string;
  sensorToBodyQualification?: string;
  sensorToBody?: SensorToBodyMatrix;
  reserved1?: number;
  reserved2?: readonly [number, number, number];
  imageSize?: number;
}

function writeU16LE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32LE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
}

function manifestImage(options: ManifestFixtureOptions = {}): Uint8Array {
  const offset = options.offset ?? 32;
  const imageSize = options.imageSize ?? offset + STRUCT_SIZE + 16;
  const image = new Uint8Array(imageSize);
  writeU32LE(image, offset, MAGIC);
  writeU16LE(image, offset + 4, options.schemaVersion ?? SCHEMA_VERSION);
  writeU16LE(image, offset + 6, options.structSize ?? STRUCT_SIZE);
  writeU16LE(image, offset + 10, options.boardProfileId ?? 3);
  writeU16LE(
    image,
    offset + 12,
    options.flags ?? VQF_FIXED_DEFAULT_1KHZ_FLAG,
  );
  image[offset + 14] = options.boardInterruptCount ?? 1;
  image[offset + 15] = options.reserved0 ?? 0;
  writeU32LE(
    image,
    offset + SENSOR_ODR_HZ_OFFSET,
    options.sensorOdrHz ?? 1000,
  );
  writeU32LE(
    image,
    offset + OUTPUT_RATE_HZ_OFFSET,
    options.outputRateHz ?? 1000,
  );
  writeU32LE(
    image,
    offset + SENSOR_TO_BODY_TRANSFORM_ID_OFFSET,
    options.sensorToBodyTransformId ?? 0x00010003,
  );
  const encoder = new TextEncoder();
  const name = encoder.encode(options.boardProfileName ?? "BSS10_A01_E001_REV03");
  image.set(name.subarray(0, BOARD_PROFILE_NAME_SIZE), offset + BOARD_PROFILE_NAME_OFFSET);
  const transformName = encoder.encode(
    options.sensorToBodyTransformName ?? "REV03_ICM42688_TO_FLU_V1",
  );
  image.set(
    transformName.subarray(0, SENSOR_TO_BODY_TRANSFORM_NAME_SIZE),
    offset + SENSOR_TO_BODY_TRANSFORM_NAME_OFFSET,
  );
  const qualification = encoder.encode(
    options.sensorToBodyQualification ?? "DEFERRED_HW_SIX_FACE",
  );
  image.set(
    qualification.subarray(0, SENSOR_TO_BODY_QUALIFICATION_SIZE),
    offset + SENSOR_TO_BODY_QUALIFICATION_OFFSET,
  );
  image[offset + RESERVED1_OFFSET] = options.reserved1 ?? 0;
  const sensorToBody = options.sensorToBody ?? REV03_SENSOR_TO_BODY;
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      image[offset + SENSOR_TO_BODY_OFFSET + row * 3 + column] =
        sensorToBody[row][column] & 0xff;
    }
  }
  const reserved2 = options.reserved2 ?? [0, 0, 0];
  image.set(reserved2, offset + RESERVED2_OFFSET);
  return image;
}

const rev03 = parseIcmImuBuildManifest(manifestImage());
const rev07Options: ManifestFixtureOptions = {
  schemaVersion: 6, boardProfileId: 7, boardProfileName: "BSS10_A01_E001_REV07",
  boardInterruptCount: 1, sensorOdrHz: 1024, outputRateHz: 1024,
  flags: SENSOR_CLKIN_32000HZ_FLAG | STM32C5_CORDIC_MATH_FLAG,
  sensorToBodyTransformId: 0x00020007,
  sensorToBodyTransformName: "REV07_ICM42688_TO_FLU_V2",
  sensorToBody: REV05_SENSOR_TO_BODY, reserved2: [0,128,1],
};
const rev07 = parseIcmImuBuildManifest(manifestImage(rev07Options));
assert.ok(rev07);
assert.equal(rev07.sensorClockHz, 32768);
assert.equal(rev07.sensorClockAlwaysOn, true);
assert.equal(rev07.usesSensorClkin32000Hz, false);
assertIcmImuBuildManifestMatchesBoard(rev07, "k1_imu_rev07");
assert.throws(() => assertIcmImuBuildManifestMatchesBoard(rev07, "e2d2"), /mismatch/);
for (const invalid of [{outputRateHz:1000}, {sensorOdrHz:1000}, {schemaVersion:5},
  {reserved2:[0,125,1] as const}, {reserved2:[0,128,0] as const},
  {flags:SENSOR_CLKIN_32000HZ_FLAG | VQF_FIXED_DEFAULT_1KHZ_FLAG}]) {
  assert.throws(() => parseIcmImuBuildManifest(manifestImage({...rev07Options,...invalid})));
}
const rev07InternalOptions: ManifestFixtureOptions = {
  ...rev07Options, schemaVersion: 7, sensorOdrHz: 1000, outputRateHz: 1000,
  flags: STM32C5_CORDIC_MATH_FLAG | DEPLOYABLE_CHARACTERIZATION_FLAG,
  reserved2: [0, 0, 0],
};
const rev07Internal = parseIcmImuBuildManifest(manifestImage(rev07InternalOptions));
assert.ok(rev07Internal);
assert.equal(rev07Internal.sensorClockHz, 0);
assert.equal(rev07Internal.sensorClockAlwaysOn, false);
assert.equal(rev07Internal.usesSensorClkin32000Hz, false);
assertIcmImuBuildManifestMatchesBoard(rev07Internal, "k1_imu_rev07");
const rev07McuClockOptions: ManifestFixtureOptions = {
  ...rev07InternalOptions, schemaVersion: 8,
  flags: rev07InternalOptions.flags! | SENSOR_CLKIN_32000HZ_FLAG,
  reserved2: [0, 125, 0],
};
const rev07McuClock = parseIcmImuBuildManifest(manifestImage(rev07McuClockOptions));
assert.ok(rev07McuClock);
assert.equal(rev07McuClock.sensorClockHz, 32000);
assert.equal(rev07McuClock.sensorClockAlwaysOn, false);
assert.equal(rev07McuClock.usesSensorClkin32000Hz, true);
assertIcmImuBuildManifestMatchesBoard(rev07McuClock, "k1_imu_rev07");
for (const invalid of [{reserved2:[0,128,1] as const}, {reserved2:[0,125,2] as const},
  {reserved2:[0,0,0] as const}, {flags:STM32C5_CORDIC_MATH_FLAG},
  {sensorOdrHz:1024}, {outputRateHz:1024},
  {flags:rev07McuClockOptions.flags! | VQF_FIXED_DEFAULT_1KHZ_FLAG}]) {
  assert.throws(() => parseIcmImuBuildManifest(manifestImage({...rev07McuClockOptions,...invalid})));
}
for (const invalid of [{outputRateHz:1024}, {sensorOdrHz:1024}, {schemaVersion:6},
  {reserved2:[0,128,1] as const}, {reserved2:[0,0,2] as const},
  {flags:SENSOR_CLKIN_32000HZ_FLAG}, {flags:VQF_FIXED_DEFAULT_1KHZ_FLAG},
  {boardProfileId:5, boardProfileName:"BSS10_A01_E001_REV05", boardInterruptCount:2}]) {
  assert.throws(() => parseIcmImuBuildManifest(manifestImage({...rev07InternalOptions,...invalid})));
}
assert.ok(rev03);
assert.deepEqual(rev03, {
  offset: 32,
  schemaVersion: 5,
  structSize: 432,
  flags: VQF_FIXED_DEFAULT_1KHZ_FLAG,
  sensorOdrHz: 1000,
  outputRateHz: 1000,
  isAnalysisOnlyNotFlashable: false,
  isDeployableCharacterization: false,
  usesFixedDefaultVqf1khz: true,
  usesSensorClkin32000Hz: false,
  sensorClockHz: 0,
  sensorClockAlwaysOn: false,
  usesHandoffDiagnosticsV2: false,
  usesDxlCrcStrictHw: false,
  usesStm32c5CordicMath: false,
  usesStm32c5CordicHil: false,
  usesMountAlignmentWorkflow: false,
  boardProfileId: 3,
  boardProfileName: "BSS10_A01_E001_REV03",
  boardInterruptCount: 1,
  sensorToBodyTransformId: 0x00010003,
  sensorToBodyTransformName: "REV03_ICM42688_TO_FLU_V1",
  sensorToBodyQualification: "DEFERRED_HW_SIX_FACE",
  sensorToBody: REV03_SENSOR_TO_BODY,
});

const rev05 = parseIcmImuBuildManifest(
  manifestImage({
    flags:
      VQF_FIXED_DEFAULT_1KHZ_FLAG | SENSOR_CLKIN_32000HZ_FLAG,
    boardProfileId: 5,
    boardProfileName: "BSS10_A01_E001_REV05",
    boardInterruptCount: 2,
    sensorToBodyTransformId: 0x00020005,
    sensorToBodyTransformName: "REV05_ICM42688_TO_FLU_V2",
    sensorToBody: REV05_SENSOR_TO_BODY,
  }),
);
assert.ok(rev05);
assert.deepEqual(rev05, {
  offset: 32,
  schemaVersion: 5,
  structSize: 432,
  flags:
    VQF_FIXED_DEFAULT_1KHZ_FLAG | SENSOR_CLKIN_32000HZ_FLAG,
  sensorOdrHz: 1000,
  outputRateHz: 1000,
  isAnalysisOnlyNotFlashable: false,
  isDeployableCharacterization: false,
  usesFixedDefaultVqf1khz: true,
  usesSensorClkin32000Hz: true,
  sensorClockHz: 32000,
  sensorClockAlwaysOn: false,
  usesHandoffDiagnosticsV2: false,
  usesDxlCrcStrictHw: false,
  usesStm32c5CordicMath: false,
  usesStm32c5CordicHil: false,
  usesMountAlignmentWorkflow: false,
  boardProfileId: 5,
  boardProfileName: "BSS10_A01_E001_REV05",
  boardInterruptCount: 2,
  sensorToBodyTransformId: 0x00020005,
  sensorToBodyTransformName: "REV05_ICM42688_TO_FLU_V2",
  sensorToBodyQualification: "DEFERRED_HW_SIX_FACE",
  sensorToBody: REV05_SENSOR_TO_BODY,
});

const genericInit = parseIcmImuBuildManifest(
  manifestImage({ flags: 0, outputRateHz: 0 }),
);
assert.ok(genericInit);
assert.equal(genericInit.flags, 0);
assert.equal(genericInit.sensorOdrHz, 1000);
assert.equal(genericInit.outputRateHz, 0);
assert.equal(genericInit.isAnalysisOnlyNotFlashable, false);
assert.equal(genericInit.isDeployableCharacterization, false);
assert.equal(genericInit.usesFixedDefaultVqf1khz, false);
assert.equal(genericInit.usesSensorClkin32000Hz, false);
assert.equal(genericInit.usesHandoffDiagnosticsV2, false);
assert.equal(genericInit.usesDxlCrcStrictHw, false);
assert.equal(genericInit.usesStm32c5CordicMath, false);
assert.equal(genericInit.usesStm32c5CordicHil, false);
assert.equal(genericInit.usesMountAlignmentWorkflow, false);

const artifactRoles = parseIcmImuBuildManifest(
  manifestImage({
    flags:
      ANALYSIS_ONLY_NOT_FLASHABLE_FLAG |
      DEPLOYABLE_CHARACTERIZATION_FLAG,
    outputRateHz: 0,
  }),
);
assert.ok(artifactRoles);
assert.equal(artifactRoles.isAnalysisOnlyNotFlashable, true);
assert.equal(artifactRoles.isDeployableCharacterization, true);

const handoffV2 = parseIcmImuBuildManifest(
  manifestImage({
    flags: VQF_FIXED_DEFAULT_1KHZ_FLAG | HANDOFF_DIAGNOSTICS_V2_FLAG,
  }),
);
assert.ok(handoffV2);
assert.equal(handoffV2.usesHandoffDiagnosticsV2, true);

const cordicHil = parseIcmImuBuildManifest(
  manifestImage({
    flags:
      LAB_ONLY_FLAG |
      ANALYSIS_ONLY_NOT_FLASHABLE_FLAG |
      DXL_CRC_STRICT_HW_FLAG |
      STM32C5_CORDIC_MATH_FLAG |
      STM32C5_CORDIC_HIL_FLAG,
  }),
);
assert.ok(cordicHil);
assert.equal(cordicHil.usesDxlCrcStrictHw, true);
assert.equal(cordicHil.usesStm32c5CordicMath, true);
assert.equal(cordicHil.usesStm32c5CordicHil, true);

assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({ flags: STM32C5_CORDIC_HIL_FLAG }),
    ),
  /CORDIC HIL requires CORDIC math, LAB_ONLY, and ANALYSIS_ONLY_NOT_FLASHABLE/,
);
assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({
        flags:
          LAB_ONLY_FLAG |
          ANALYSIS_ONLY_NOT_FLASHABLE_FLAG |
          DEPLOYABLE_CHARACTERIZATION_FLAG |
          STM32C5_CORDIC_MATH_FLAG |
          STM32C5_CORDIC_HIL_FLAG,
      }),
    ),
  /forbids DEPLOYABLE_CHARACTERIZATION/,
);
const mountWorkflow = parseIcmImuBuildManifest(
  manifestImage({ flags: MOUNT_ALIGNMENT_WORKFLOW_FLAG }),
);
assert.ok(mountWorkflow);
assert.equal(mountWorkflow.usesMountAlignmentWorkflow, true);
assert.doesNotThrow(() =>
  assertIcmImuBuildManifestMatchesBoard(rev03, "BSS10_A01_E001_REV03"),
);
assert.throws(
  () => assertIcmImuBuildManifestMatchesBoard(rev03, "BSS10_A01_E001_REV05"),
  /board profile mismatch; no flash erase or image write was attempted/,
);

assert.equal(parseIcmImuBuildManifest(new Uint8Array([1, 2, 3, 4])), undefined);

/*
 * Non-LTO ARM images can retain IMU_BUILD_MANIFEST_MAGIC as a comparison
 * literal in addition to the structured manifest. Incidental candidates,
 * including one too close to EOF for a header, must not make a valid image
 * ambiguous.
 */
const validWithComparisonLiterals = manifestImage({
  offset: 64,
  imageSize: 64 + STRUCT_SIZE + 32,
});
writeU32LE(validWithComparisonLiterals, 8, MAGIC);
validWithComparisonLiterals.set(
  new Uint8Array([0x10, 0xb5, 0x04, 0x46]),
  12,
);
writeU32LE(validWithComparisonLiterals, validWithComparisonLiterals.length - 4, MAGIC);
const discoveredAmongLiterals = parseIcmImuBuildManifest(
  validWithComparisonLiterals,
);
assert.ok(discoveredAmongLiterals);
assert.equal(discoveredAmongLiterals.offset, 64);

assert.throws(
  () => parseIcmImuBuildManifest(manifestImage({ schemaVersion: 4 })),
  /unsupported ICM build manifest schema 4; updater supports schema 5/,
);
const truncatedHeader = new Uint8Array(7);
writeU32LE(truncatedHeader, 3, MAGIC);
assert.throws(
  () => parseIcmImuBuildManifest(truncatedHeader),
  /truncated ICM build manifest header at image offset 3/,
);

assert.throws(
  () => parseIcmImuBuildManifest(manifestImage({ structSize: 431 })),
  /struct size is 431, expected 432/,
);
assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage().slice(0, 32 + STRUCT_SIZE - 1),
    ),
  /truncated ICM build manifest/,
);

const missingTerminator = manifestImage();
missingTerminator.fill(
  0x41,
  32 + BOARD_PROFILE_NAME_OFFSET,
  32 + BOARD_PROFILE_NAME_OFFSET + BOARD_PROFILE_NAME_SIZE,
);
assert.throws(
  () => parseIcmImuBuildManifest(missingTerminator),
  /board_profile_name must be a non-empty NUL-terminated string/,
);

const nonZeroPadding = manifestImage();
nonZeroPadding[32 + BOARD_PROFILE_NAME_OFFSET + 23] = 0x41;
assert.throws(
  () => parseIcmImuBuildManifest(nonZeroPadding),
  /board_profile_name has non-zero padding/,
);

assert.throws(
  () => parseIcmImuBuildManifest(manifestImage({ reserved0: 1 })),
  /reserved0 is not zero/,
);
assert.throws(
  () => parseIcmImuBuildManifest(manifestImage({ reserved1: 1 })),
  /reserved1 is not zero/,
);
for (let index = 0; index < 3; index++) {
  const reserved2 = [0, 0, 0] as [number, number, number];
  reserved2[index] = 1;
  assert.throws(
    () => parseIcmImuBuildManifest(manifestImage({ reserved2 })),
    /reserved2 is not zero/,
  );
}

assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({
        boardProfileId: 3,
        boardProfileName: "BSS10_A01_E001_REV05",
        boardInterruptCount: 2,
      }),
    ),
  /board profile 3 identifies "BSS10_A01_E001_REV03"/,
);

assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({
        flags: SENSOR_CLKIN_32000HZ_FLAG,
      }),
    ),
  /does not route MCU 32 kHz CLKIN/,
);

assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({
        sensorToBodyTransformId: 0x00020005,
      }),
    ),
  /board profile 3 requires sensor-to-body transform 0x00010003/,
);

assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({
        sensorToBodyTransformName: "REV05_ICM42688_TO_FLU_V2",
      }),
    ),
  /board profile 3 requires sensor-to-body transform/,
);

assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({
        sensorToBodyQualification: "QUALIFIED",
      }),
    ),
  /with qualification "DEFERRED_HW_SIX_FACE"/,
);

for (let coefficient = 0; coefficient < 9; coefficient++) {
  const wrongMatrix = manifestImage();
  const coefficientOffset = 32 + SENSOR_TO_BODY_OFFSET + coefficient;
  wrongMatrix[coefficientOffset] =
    wrongMatrix[coefficientOffset] === 0 ? 1 : 0;
  assert.throws(
    () => parseIcmImuBuildManifest(wrongMatrix),
    /board profile 3 requires sensor-to-body matrix/,
  );
}

assert.throws(
  () =>
    parseIcmImuBuildManifest(
      manifestImage({
        boardProfileId: 5,
        boardProfileName: "BSS10_A01_E001_REV05",
        boardInterruptCount: 2,
        sensorToBodyTransformId: 0x00020005,
        sensorToBodyTransformName: "REV05_ICM42688_TO_FLU_V2",
        sensorToBody: REV03_SENSOR_TO_BODY,
      }),
    ),
  /board profile 5 requires sensor-to-body matrix/,
);

const duplicate = manifestImage({ offset: 0, imageSize: STRUCT_SIZE * 2 });
duplicate.set(manifestImage({ offset: 0, imageSize: STRUCT_SIZE }), STRUCT_SIZE);
assert.throws(
  () => parseIcmImuBuildManifest(duplicate),
  /ambiguous ICM build manifest: found 2 fully valid schema-5 manifests at image offsets 0, 432/,
);

const validAndMalformed = manifestImage({
  offset: 0,
  imageSize: STRUCT_SIZE * 2,
});
validAndMalformed.set(
  manifestImage({
    offset: 0,
    imageSize: STRUCT_SIZE,
    reserved1: 1,
  }),
  STRUCT_SIZE,
);
const onlyFullyValid = parseIcmImuBuildManifest(validAndMalformed);
assert.ok(onlyFullyValid);
assert.equal(onlyFullyValid.offset, 0);

const malformedWithComparisonLiteral = manifestImage({
  offset: 64,
  imageSize: 64 + STRUCT_SIZE + 16,
  reserved0: 1,
});
writeU32LE(malformedWithComparisonLiteral, 8, MAGIC);
malformedWithComparisonLiteral.set(
  new Uint8Array([0x10, 0xb5, 0x04, 0x46]),
  12,
);
assert.throws(
  () => parseIcmImuBuildManifest(malformedWithComparisonLiteral),
  (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /no fully valid schema-5 manifest was found/);
    assert.match(error.message, /image offset 8: unsupported ICM build manifest schema/);
    assert.match(error.message, /image offset 64: malformed ICM build manifest: reserved0 is not zero/);
    return true;
  },
);

const unsupportedWithComparisonLiteral = manifestImage({
  offset: 64,
  imageSize: 64 + STRUCT_SIZE + 16,
  schemaVersion: 9,
});
writeU32LE(unsupportedWithComparisonLiteral, 8, MAGIC);
unsupportedWithComparisonLiteral.set(
  new Uint8Array([0x10, 0xb5, 0x04, 0x46]),
  12,
);
assert.throws(
  () => parseIcmImuBuildManifest(unsupportedWithComparisonLiteral),
  /unsupported ICM build manifest schema 9; updater supports schema 5, 6, 7 and 8/,
);

const comparisonLiteralsOnly = new Uint8Array(24);
writeU32LE(comparisonLiteralsOnly, 4, MAGIC);
comparisonLiteralsOnly.set(new Uint8Array([0x10, 0xb5, 0x04, 0x46]), 8);
writeU32LE(comparisonLiteralsOnly, 20, MAGIC);
assert.throws(
  () => parseIcmImuBuildManifest(comparisonLiteralsOnly),
  (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /magic found at 2 image offsets/);
    assert.match(error.message, /no fully valid schema-5 manifest was found/);
    assert.match(error.message, /image offset 4: unsupported ICM build manifest schema/);
    assert.match(error.message, /image offset 20: truncated ICM build manifest header/);
    return true;
  },
);

console.log("IMU build manifest tests ok");
