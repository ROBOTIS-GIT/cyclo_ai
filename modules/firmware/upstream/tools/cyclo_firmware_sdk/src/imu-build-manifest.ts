const IMU_BUILD_MANIFEST_MAGIC = 0x494d554d;
const IMU_BUILD_MANIFEST_SCHEMA_VERSION = 5;
const IMU_BUILD_MANIFEST_STRUCT_SIZE = 432;
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
const KNOWN_BUILD_FLAGS_MASK = (1 << 16) - 1;
const SENSOR_ODR_HZ_OFFSET = 16;
const OUTPUT_RATE_HZ_OFFSET = 20;
const SENSOR_TO_BODY_TRANSFORM_ID_OFFSET = 44;
const BOARD_PROFILE_NAME_OFFSET = 88;
const BOARD_PROFILE_NAME_SIZE = 24;
const SENSOR_TO_BODY_TRANSFORM_NAME_OFFSET = 112;
const SENSOR_TO_BODY_TRANSFORM_NAME_SIZE = 32;
const SENSOR_TO_BODY_QUALIFICATION_OFFSET = 144;
const SENSOR_TO_BODY_QUALIFICATION_SIZE = 24;
const RESERVED1_OFFSET = 419;
const SENSOR_TO_BODY_OFFSET = 420;
const RESERVED2_OFFSET = 429;
const RESERVED2_SIZE = 3;

export type SensorToBodyMatrix = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

interface KnownBoardProfile {
  readonly name: string;
  readonly interruptCount: number;
  readonly supportsSensorClkin32000Hz: boolean;
  readonly sensorToBodyTransformId: number;
  readonly sensorToBodyTransformName: string;
  readonly sensorToBodyQualification: string;
  readonly sensorToBody: SensorToBodyMatrix;
}

const KNOWN_BOARD_PROFILES = new Map<number, KnownBoardProfile>([
  [
    3,
    {
      name: "BSS10_A01_E001_REV03",
      interruptCount: 1,
      supportsSensorClkin32000Hz: false,
      sensorToBodyTransformId: 0x00010003,
      sensorToBodyTransformName: "REV03_ICM42688_TO_FLU_V1",
      sensorToBodyQualification: "DEFERRED_HW_SIX_FACE",
      sensorToBody: [
        [0, 0, -1],
        [0, 1, 0],
        [1, 0, 0],
      ],
    },
  ],
  [
    5,
    {
      name: "BSS10_A01_E001_REV05",
      interruptCount: 2,
      supportsSensorClkin32000Hz: true,
      sensorToBodyTransformId: 0x00020005,
      sensorToBodyTransformName: "REV05_ICM42688_TO_FLU_V2",
      sensorToBodyQualification: "DEFERRED_HW_SIX_FACE",
      sensorToBody: [
        [0, 0, -1],
        [-1, 0, 0],
        [0, 1, 0],
      ],
    },
  ],
  [7, {
    name: "BSS10_A01_E001_REV07",
    interruptCount: 1,
    supportsSensorClkin32000Hz: true,
    sensorToBodyTransformId: 0x00020007,
    sensorToBodyTransformName: "REV07_ICM42688_TO_FLU_V2",
    sensorToBodyQualification: "DEFERRED_HW_SIX_FACE",
    sensorToBody: [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  }],
]);

export interface IcmImuBuildManifest {
  readonly offset: number;
  readonly schemaVersion: 5 | 6 | 7 | 8;
  readonly structSize: 432;
  readonly flags: number;
  readonly sensorOdrHz: number;
  readonly outputRateHz: number;
  readonly isAnalysisOnlyNotFlashable: boolean;
  readonly isDeployableCharacterization: boolean;
  readonly usesFixedDefaultVqf1khz: boolean;
  readonly usesSensorClkin32000Hz: boolean;
  readonly sensorClockHz: number;
  readonly sensorClockAlwaysOn: boolean;
  readonly usesHandoffDiagnosticsV2: boolean;
  readonly usesDxlCrcStrictHw: boolean;
  readonly usesStm32c5CordicMath: boolean;
  readonly usesStm32c5CordicHil: boolean;
  readonly usesMountAlignmentWorkflow: boolean;
  readonly boardProfileId: number;
  readonly boardProfileName: string;
  readonly boardInterruptCount: number;
  readonly sensorToBodyTransformId: number;
  readonly sensorToBodyTransformName: string;
  readonly sensorToBodyQualification: string;
  readonly sensorToBody: SensorToBodyMatrix;
}

function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

function readI8(data: Uint8Array, offset: number): number {
  const value = data[offset];
  return value < 0x80 ? value : value - 0x100;
}

function readSensorToBodyMatrix(
  data: Uint8Array,
  offset: number,
): SensorToBodyMatrix {
  return [
    [readI8(data, offset), readI8(data, offset + 1), readI8(data, offset + 2)],
    [readI8(data, offset + 3), readI8(data, offset + 4), readI8(data, offset + 5)],
    [readI8(data, offset + 6), readI8(data, offset + 7), readI8(data, offset + 8)],
  ];
}

function sensorToBodyMatricesEqual(
  left: SensorToBodyMatrix,
  right: SensorToBodyMatrix,
): boolean {
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      if (left[row][column] !== right[row][column]) {
        return false;
      }
    }
  }
  return true;
}

function parseZeroPaddedAscii(
  data: Uint8Array,
  offset: number,
  size: number,
  fieldName: string,
): string {
  const field = data.subarray(offset, offset + size);
  const terminator = field.indexOf(0);
  if (terminator <= 0) {
    throw new Error(`malformed ICM build manifest: ${fieldName} must be a non-empty NUL-terminated string`);
  }
  for (let index = 0; index < terminator; index++) {
    if (field[index] < 0x21 || field[index] > 0x7e) {
      throw new Error(`malformed ICM build manifest: ${fieldName} contains non-printable ASCII`);
    }
  }
  for (let index = terminator + 1; index < field.length; index++) {
    if (field[index] !== 0) {
      throw new Error(`malformed ICM build manifest: ${fieldName} has non-zero padding`);
    }
  }
  return new TextDecoder("ascii", { fatal: true }).decode(field.subarray(0, terminator));
}

function findManifestMagicOffsets(image: Uint8Array): number[] {
  const offsets: number[] = [];
  for (let offset = 0; offset + 4 <= image.length; offset++) {
    if (readU32LE(image, offset) === IMU_BUILD_MANIFEST_MAGIC) {
      offsets.push(offset);
    }
  }
  return offsets;
}

function parseManifestCandidateAt(
  image: Uint8Array,
  offset: number,
): IcmImuBuildManifest {
  if (offset + 8 > image.length) {
    throw new Error(`truncated ICM build manifest header at image offset ${offset}`);
  }
  const schemaVersion = readU16LE(image, offset + 4);
  if (schemaVersion !== IMU_BUILD_MANIFEST_SCHEMA_VERSION && schemaVersion !== 6 && schemaVersion !== 7 && schemaVersion !== 8) {
    throw new Error(
      `unsupported ICM build manifest schema ${schemaVersion}; updater supports schema ` +
        "5, 6, 7 and 8",
    );
  }
  const structSize = readU16LE(image, offset + 6);
  if (structSize !== IMU_BUILD_MANIFEST_STRUCT_SIZE) {
    throw new Error(
      `malformed ICM build manifest: schema 5 struct size is ${structSize}, expected ${IMU_BUILD_MANIFEST_STRUCT_SIZE}`,
    );
  }
  if (offset + structSize > image.length) {
    throw new Error(
      `truncated ICM build manifest: need ${structSize} bytes at image offset ${offset}, ` +
        `only ${image.length - offset} remain`,
    );
  }

  const boardProfileId = readU16LE(image, offset + 10);
  const flags = readU16LE(image, offset + 12);
  const boardInterruptCount = image[offset + 14];
  const reserved0 = image[offset + 15];
  const sensorOdrHz = readU32LE(image, offset + SENSOR_ODR_HZ_OFFSET);
  const outputRateHz = readU32LE(image, offset + OUTPUT_RATE_HZ_OFFSET);
  const reserved1 = image[offset + RESERVED1_OFFSET];
  const sensorToBody = readSensorToBodyMatrix(
    image,
    offset + SENSOR_TO_BODY_OFFSET,
  );
  const sensorToBodyTransformId = readU32LE(
    image,
    offset + SENSOR_TO_BODY_TRANSFORM_ID_OFFSET,
  );
  const unknownFlags = flags & ~KNOWN_BUILD_FLAGS_MASK;
  if (unknownFlags !== 0) {
    throw new Error(
      `unsupported ICM build manifest flags 0x${unknownFlags.toString(16).padStart(4, "0")}`,
    );
  }
  const usesStm32c5CordicMath =
    (flags & STM32C5_CORDIC_MATH_FLAG) !== 0;
  const usesStm32c5CordicHil =
    (flags & STM32C5_CORDIC_HIL_FLAG) !== 0;
  const isAnalysisOnlyNotFlashable =
    (flags & ANALYSIS_ONLY_NOT_FLASHABLE_FLAG) !== 0;
  const isDeployableCharacterization =
    (flags & DEPLOYABLE_CHARACTERIZATION_FLAG) !== 0;
  if (
    usesStm32c5CordicHil &&
    (
      !usesStm32c5CordicMath ||
      (flags & LAB_ONLY_FLAG) === 0 ||
      !isAnalysisOnlyNotFlashable ||
      isDeployableCharacterization
    )
  ) {
    throw new Error(
      "malformed ICM build manifest: STM32C5 CORDIC HIL requires " +
        "CORDIC math, LAB_ONLY, and ANALYSIS_ONLY_NOT_FLASHABLE flags, " +
        "and forbids DEPLOYABLE_CHARACTERIZATION",
    );
  }
  if (reserved0 !== 0) {
    throw new Error("malformed ICM build manifest: reserved0 is not zero");
  }
  if (reserved1 !== 0) {
    throw new Error("malformed ICM build manifest: reserved1 is not zero");
  }
  for (let index = 0; schemaVersion === 5 && index < RESERVED2_SIZE; index++) {
    if (image[offset + RESERVED2_OFFSET + index] !== 0) {
      throw new Error("malformed ICM build manifest: reserved2 is not zero");
    }
  }

  const boardProfileName = parseZeroPaddedAscii(
    image,
    offset + BOARD_PROFILE_NAME_OFFSET,
    BOARD_PROFILE_NAME_SIZE,
    "board_profile_name",
  );
  const sensorToBodyTransformName = parseZeroPaddedAscii(
    image,
    offset + SENSOR_TO_BODY_TRANSFORM_NAME_OFFSET,
    SENSOR_TO_BODY_TRANSFORM_NAME_SIZE,
    "sensor_to_body_transform_name",
  );
  const sensorToBodyQualification = parseZeroPaddedAscii(
    image,
    offset + SENSOR_TO_BODY_QUALIFICATION_OFFSET,
    SENSOR_TO_BODY_QUALIFICATION_SIZE,
    "sensor_to_body_qualification",
  );
  const knownProfile = KNOWN_BOARD_PROFILES.get(boardProfileId);
  if (!knownProfile) {
    throw new Error(`malformed ICM build manifest: unknown board_profile_id ${boardProfileId}`);
  }
  if (
    boardProfileName !== knownProfile.name ||
    boardInterruptCount !== knownProfile.interruptCount
  ) {
    throw new Error(
      `malformed ICM build manifest: board profile ${boardProfileId} identifies ` +
        `"${knownProfile.name}" with ${knownProfile.interruptCount} interrupt(s), got ` +
      `"${boardProfileName}" with ${boardInterruptCount}`,
    );
  }
  const usesExternalClock = (flags & SENSOR_CLKIN_32000HZ_FLAG) !== 0;
  const sensorClockHz = schemaVersion >= 6
    ? readU16LE(image, offset + RESERVED2_OFFSET) : (usesExternalClock ? 32000 : 0);
  const sensorClockAlwaysOn = schemaVersion >= 6 && image[offset + RESERVED2_OFFSET + 2] === 1;
  if ((schemaVersion >= 6) !== (boardProfileId === 7) ||
      (schemaVersion === 6 && (!usesExternalClock || sensorClockHz !== 32768 ||
        !sensorClockAlwaysOn || sensorOdrHz !== 1024 || outputRateHz !== 1024 ||
        (flags & VQF_FIXED_DEFAULT_1KHZ_FLAG) !== 0))) {
    throw new Error("malformed REV07 manifest: schema 6 requires an always-on 32768 Hz clock and rate-aware 1024 Hz estimator");
  }
  if (schemaVersion === 7 && (usesExternalClock || sensorClockHz !== 0 ||
      image[offset + RESERVED2_OFFSET + 2] !== 0 || sensorOdrHz !== 1000 ||
      outputRateHz !== 1000 || (flags & VQF_FIXED_DEFAULT_1KHZ_FLAG) !== 0)) {
    throw new Error("malformed REV07 manifest: schema 7 requires internal sensor clock and rate-aware nominal 1000 Hz estimator");
  }
  if (schemaVersion === 8 && (!usesExternalClock || sensorClockHz !== 32000 ||
      image[offset + RESERVED2_OFFSET + 2] !== 0 || sensorOdrHz !== 1000 ||
      outputRateHz !== 1000 || (flags & VQF_FIXED_DEFAULT_1KHZ_FLAG) !== 0)) {
    throw new Error("malformed REV07 manifest: schema 8 requires MCU-generated 32000 Hz clock and rate-aware 1000 Hz estimator");
  }
  const usesSensorClkin32000Hz = usesExternalClock && sensorClockHz === 32000;
  if (usesExternalClock && !knownProfile.supportsSensorClkin32000Hz) {
    throw new Error(
      `malformed ICM build manifest: board profile ${boardProfileId} does not ` +
        "route MCU 32 kHz CLKIN to ICM-42688-P pin 9",
    );
  }
  if (
    sensorToBodyTransformId !== knownProfile.sensorToBodyTransformId ||
    sensorToBodyTransformName !== knownProfile.sensorToBodyTransformName ||
    sensorToBodyQualification !== knownProfile.sensorToBodyQualification
  ) {
    const expectedTransformId = knownProfile.sensorToBodyTransformId
      .toString(16)
      .padStart(8, "0");
    const actualTransformId = sensorToBodyTransformId.toString(16).padStart(8, "0");
    throw new Error(
      `malformed ICM build manifest: board profile ${boardProfileId} requires ` +
        `sensor-to-body transform 0x${expectedTransformId} ` +
        `"${knownProfile.sensorToBodyTransformName}" with qualification ` +
        `"${knownProfile.sensorToBodyQualification}", got 0x${actualTransformId} ` +
        `"${sensorToBodyTransformName}" with qualification ` +
        `"${sensorToBodyQualification}"`,
    );
  }
  if (!sensorToBodyMatricesEqual(sensorToBody, knownProfile.sensorToBody)) {
    throw new Error(
      `malformed ICM build manifest: board profile ${boardProfileId} requires ` +
        `sensor-to-body matrix ${JSON.stringify(knownProfile.sensorToBody)}, got ` +
        JSON.stringify(sensorToBody),
    );
  }

  return {
    offset,
    schemaVersion,
    structSize: IMU_BUILD_MANIFEST_STRUCT_SIZE,
    flags,
    sensorOdrHz,
    outputRateHz,
    isAnalysisOnlyNotFlashable,
    isDeployableCharacterization,
    usesFixedDefaultVqf1khz:
      (flags & VQF_FIXED_DEFAULT_1KHZ_FLAG) !== 0,
    usesSensorClkin32000Hz,
    sensorClockHz,
    sensorClockAlwaysOn,
    usesHandoffDiagnosticsV2:
      (flags & HANDOFF_DIAGNOSTICS_V2_FLAG) !== 0,
    usesDxlCrcStrictHw:
      (flags & DXL_CRC_STRICT_HW_FLAG) !== 0,
    usesStm32c5CordicMath,
    usesStm32c5CordicHil,
    usesMountAlignmentWorkflow:
      (flags & MOUNT_ALIGNMENT_WORKFLOW_FLAG) !== 0,
    boardProfileId,
    boardProfileName,
    boardInterruptCount,
    sensorToBodyTransformId,
    sensorToBodyTransformName,
    sensorToBodyQualification,
    sensorToBody,
  };
}

function candidateFailureMessage(offset: number, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `image offset ${offset}: ${detail}`;
}

/**
 * Finds the schema-5 ICM application manifest in a raw firmware image.
 *
 * The magic value is also present as an ordinary comparison literal in some
 * non-LTO application images. Therefore, uniqueness is determined only after
 * every magic candidate has passed the complete schema-5 validation above.
 *
 * Images without the ICM manifest magic are deliberately left untouched so
 * generic and legacy firmware flashing retains its existing behavior. An
 * image containing magic but no valid manifest is rejected fail-closed.
 */
export function parseIcmImuBuildManifest(image: Uint8Array): IcmImuBuildManifest | undefined {
  const offsets = findManifestMagicOffsets(image);
  if (offsets.length === 0) {
    return undefined;
  }

  const manifests: IcmImuBuildManifest[] = [];
  const failures: Array<{ readonly offset: number; readonly error: unknown }> = [];
  for (const offset of offsets) {
    try {
      manifests.push(parseManifestCandidateAt(image, offset));
    } catch (error) {
      failures.push({ offset, error });
    }
  }

  if (manifests.length === 1) {
    return manifests[0];
  }
  if (manifests.length > 1) {
    throw new Error(
      `ambiguous ICM build manifest: found ${manifests.length} fully valid schema-5 ` +
        `manifests at image offsets ${manifests.map(({ offset }) => offset).join(", ")}`,
    );
  }

  /*
   * Preserve the existing precise error for the common one-candidate case.
   * With multiple invalid candidates, report every reason instead of guessing
   * which occurrence was intended to be the retained manifest.
   */
  if (failures.length === 1) {
    throw failures[0].error;
  }
  throw new Error(
    `ICM build manifest magic found at ${failures.length} image offsets, but no ` +
      `fully valid schema-5 manifest was found: ${failures
        .map(({ offset, error }) => candidateFailureMessage(offset, error))
        .join("; ")}`,
  );
}

export function assertIcmImuBuildManifestMatchesBoard(
  manifest: IcmImuBuildManifest,
  bootloaderBoardId: string,
): void {
  const expectedBoardId = manifest.boardProfileId === 7 ? "k1_imu_rev07" : manifest.boardProfileName;
  if (expectedBoardId !== bootloaderBoardId) {
    throw new Error(
      `refusing to flash ICM image for "${manifest.boardProfileName}" to bootloader board ` +
        `"${bootloaderBoardId}": board profile mismatch; no flash erase or image write was attempted`,
    );
  }
}
