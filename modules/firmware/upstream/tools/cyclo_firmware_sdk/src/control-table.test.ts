import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  E2D2_H5_CONTROL_TABLE_SCHEMA,
  E2D2_H5_CONTROL_TABLE_SCHEMAS,
  E2D2_H5_FW13_CONTROL_TABLE_SCHEMA,
  E2D2_H5_FW15_CONTROL_TABLE_SCHEMA,
  E2D2_H5_FW17_CONTROL_TABLE_SCHEMA,
  E2D2_H5_FW19_CONTROL_TABLE_SCHEMA,
  E2D2_H5_FW21_CONTROL_TABLE_SCHEMA,
  E2D2_H5_LEGACY_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMAS,
  ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW13_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW14_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW46_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW47_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW48_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW50_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_FW49_CONTROL_TABLE_SCHEMA,
  K1_BNO085_IMU_CONTROL_TABLE_SCHEMA,
  K1_HAT_C5_CONTROL_TABLE_SCHEMA,
  K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA,
  K1_HAT_C5_REV06_FW36_CONTROL_TABLE_SCHEMA,
  K1_HAT_C5_REV06_FW41_CONTROL_TABLE_SCHEMA,
  K1_HAT_H5_REV06_CONTROL_TABLE_SCHEMA,
  K1_IMU_REV07_CONTROL_TABLE_SCHEMA,
  K1_IMU_REV07_FW55_CONTROL_TABLE_SCHEMA,
  OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA,
  OPENRB_CRSF_CONTROL_TABLE_SCHEMA,
  OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA,
  QC060_200_R020_RE_CONTROL_TABLE_SCHEMA,
  QC080_240_R020_RE_CONTROL_TABLE_SCHEMA,
  QDD_Q1_CONTROL_TABLE_SCHEMA,
  QDD_Q3_CONTROL_TABLE_SCHEMA,
  createKnownDevice,
  type DynamixelClient,
  decodeControlTableValue,
  encodeControlTableValue,
  formatControlTableValue,
  getControlTableSchemaForDevice,
  getControlTableLabelOptions,
  getKnownDeviceName,
  isIpv4ControlTableItem,
  isControlTableReadable,
  planControlTableReadBlocks,
  type ControlTableSchema,
} from "./index.js";

function assertReadableSchemaInvariants(schemas: readonly ControlTableSchema[]) {
  const nonReadable = schemas.flatMap((schema) =>
    schema.items
      .filter((item) => !isControlTableReadable(item))
      .map((item) => `${schema.name}@fw${schema.minimumFirmwareVersion ?? 0}:${item.address}:${item.name}:${item.access}`),
  );
  assert.deepEqual(nonReadable, []);

  for (const schema of schemas) {
    const outOfRange = schema.items
      .filter((item) => item.address < 0 || item.length <= 0 || item.address + item.length > schema.size)
      .map((item) => `${schema.name}@fw${schema.minimumFirmwareVersion ?? 0}:${item.address}:${item.length}:${schema.size}:${item.name}`);
    assert.deepEqual(outOfRange, []);
    assert.deepEqual(planControlTableReadBlocks(schema, { maxBlockLength: schema.size }), [
      { address: 0, length: schema.size },
    ]);
  }
}

const ALL_EXPORTED_CONTROL_TABLE_SCHEMAS: readonly ControlTableSchema[] = [
  ...E2D2_H5_CONTROL_TABLE_SCHEMAS,
  ...ICM42688_C5_IMU_CONTROL_TABLE_SCHEMAS,
  K1_IMU_REV07_CONTROL_TABLE_SCHEMA,
  K1_BNO085_IMU_CONTROL_TABLE_SCHEMA,
  K1_HAT_C5_CONTROL_TABLE_SCHEMA,
  K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA,
  K1_HAT_C5_REV06_FW36_CONTROL_TABLE_SCHEMA,
  OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA,
  OPENRB_CRSF_CONTROL_TABLE_SCHEMA,
  OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA,
  QDD_Q1_CONTROL_TABLE_SCHEMA,
  QDD_Q3_CONTROL_TABLE_SCHEMA,
  QC060_200_R020_RE_CONTROL_TABLE_SCHEMA,
  QC080_240_R020_RE_CONTROL_TABLE_SCHEMA,
];

assertReadableSchemaInvariants(ALL_EXPORTED_CONTROL_TABLE_SCHEMAS);

assert.equal(getControlTableSchemaForDevice(5105, 35)?.name, "K1 HAT C5 (revision unverified)");
assert.equal(getControlTableSchemaForDevice(5105, 36)?.name, "K1 HAT C5 (revision unverified)");
assert.deepEqual(getControlTableSchemaForDevice(5105, 36)?.items, K1_HAT_C5_REV06_FW36_CONTROL_TABLE_SCHEMA.items);
assert.equal(getControlTableSchemaForDevice(5105, 39), K1_HAT_C5_REV06_FW41_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(5105, 41), K1_HAT_C5_REV06_FW41_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(5105, 43), K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA);
assert.equal(K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA.items.find(item => item.name === "Firmware Version")?.init, 43);
assert.equal(K1_HAT_C5_REV06_FW41_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 112)?.max, 2);
assert.equal(K1_HAT_C5_REV06_FW41_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 1602)?.init, 17);
assert.equal(K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 112)?.max, 3);
assert.equal(K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 1602)?.init, 49);
assert.equal(K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA.size, 1864);
assert.equal(getControlTableSchemaForDevice(6050, 30), K1_HAT_H5_REV06_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 29), E2D2_H5_CONTROL_TABLE_SCHEMA);
assert.equal(K1_HAT_H5_REV06_CONTROL_TABLE_SCHEMA.size, 864);
assert.equal(K1_HAT_H5_REV06_CONTROL_TABLE_SCHEMA.items.find(item => item.name === "Ethernet Ready")?.address, 834);
assert.equal(K1_HAT_H5_REV06_CONTROL_TABLE_SCHEMA.items.find(item => item.name === "Ethernet Startup State")?.access, "r");
for (const version of [52,53,54]) {
  const schema = getControlTableSchemaForDevice(42689, version);
  assert.equal(schema?.size, 624);
  assert(schema?.items.every(item => item.address + item.length <= 624));
}
assert.equal(getControlTableSchemaForDevice(42689, 55), K1_IMU_REV07_FW55_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42689, 56), K1_IMU_REV07_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42689, 57), K1_IMU_REV07_CONTROL_TABLE_SCHEMA);
assert.equal(K1_IMU_REV07_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 6)?.init, 56);
for (const version of [52, 53, 54, 55]) {
  const schema = getControlTableSchemaForDevice(42689, version);
  assert.deepEqual(schema?.items.find(item => item.address === 70)?.labels?.slice(6), ["-", "-"]);
}
assert.deepEqual(K1_IMU_REV07_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 70)?.labels,
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 70)?.labels);
assert.equal(K1_IMU_REV07_CONTROL_TABLE_SCHEMA.size, 664);
const rawGyro = K1_IMU_REV07_CONTROL_TABLE_SCHEMA.items.find(item => item.address === 636);
assert.equal(rawGyro?.valueType, "int");
assert.equal(rawGyro?.scale, 1 / 1048576);
assert.equal(rawGyro?.unit, "rad/s");
assert.equal(getControlTableSchemaForDevice(42688, 52), ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 53), ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA);
assert.equal(K1_IMU_REV07_CONTROL_TABLE_SCHEMA.modelNumber, 42689);
assert.equal(K1_IMU_REV07_CONTROL_TABLE_SCHEMA.items.find(item => item.name === "Model Number")?.init, 42689);
assert.equal(getKnownDeviceName(42689), "K1 IMU REV07");
assert.equal(createKnownDevice(42689, {} as DynamixelClient).kind, "k1_imu_rev07");
assert.equal(createKnownDevice(42688, {} as DynamixelClient).kind, "icm42688_c5_imu");
for (const [project, xml, model] of [
  ["icm42688_c5_imu", "ICM42688_C5_IMU.xml", 42688],
  ["k1_imu_rev07", "K1_IMU_REV07.xml", 42689],
] as const) {
  const header = readFileSync(new URL(`../../../projects/${project}/app/App/Inc/control_table/icm_dxl_ct.h`, import.meta.url), "utf8");
  assert.match(header, new RegExp(`ICM_MODEL_NUMBER\\s+${model}u`));
  const source = readFileSync(new URL(`../../../projects/${project}/${xml}`, import.meta.url), "utf8");
  assert.match(source, new RegExp(`ModelNumber="${model}"`));
  assert.equal(getControlTableSchemaForDevice(model)?.modelNumber, model);
}
for (const [existing, revision] of [
  [K1_HAT_C5_CONTROL_TABLE_SCHEMA, K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA],
  [E2D2_H5_CONTROL_TABLE_SCHEMA, K1_HAT_H5_REV06_CONTROL_TABLE_SCHEMA],
  [ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA, K1_IMU_REV07_CONTROL_TABLE_SCHEMA],
] as const) {
  assert.deepEqual(revision.items.filter(item => item.address < existing.size).map(({name, address, length}) => ({name, address, length})),
    existing.items.map(({name, address, length}) => ({name, address, length})));
}

assert.equal(getKnownDeviceName(6030), "OpenRB USB2DXL");
assert.equal(getControlTableSchemaForDevice(6030), OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA);
assert.equal(OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Power Enable")?.init, 1);
assert.equal(OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Router Max Gap")?.address, 120);
assert.equal(getKnownDeviceName(6031), "OpenRB CRSF");
assert.equal(getControlTableSchemaForDevice(6031), OPENRB_CRSF_CONTROL_TABLE_SCHEMA);
assert.equal(OPENRB_CRSF_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "CRSF Failsafe")?.init, 1);
assert.equal(getKnownDeviceName(6043), "OpenCR NeoPixel DXL");
assert.equal(getControlTableSchemaForDevice(6043), OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA);
assert.equal(OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Baud Rate (Bus)")?.init, 3);
assert.equal(OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Baud Rate (Bus)")?.memory, "ram");

assert.equal(QC060_200_R020_RE_CONTROL_TABLE_SCHEMA.modelNumber, 8030);
assert.equal(QC060_200_R020_RE_CONTROL_TABLE_SCHEMA.name, "QC060-200-R020-RE");
assert.equal(getKnownDeviceName(8030), "QC060-200-R020-RE");
assert.equal(getControlTableSchemaForDevice(8030), QC060_200_R020_RE_CONTROL_TABLE_SCHEMA);
assert.equal(QC080_240_R020_RE_CONTROL_TABLE_SCHEMA.modelNumber, 8050);
assert.equal(QC080_240_R020_RE_CONTROL_TABLE_SCHEMA.name, "QC080-240-R020-RE");
assert.equal(getKnownDeviceName(8050), "QC080-240-R020-RE");
assert.equal(getControlTableSchemaForDevice(8050), QC080_240_R020_RE_CONTROL_TABLE_SCHEMA);

assert.equal(getKnownDeviceName(42670), "Model 42670");
assert.equal(getControlTableSchemaForDevice(42670), null);
assert.equal(getControlTableSchemaForDevice(42670, 16), null);

assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.modelNumber, 42688);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.size, 624);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 52);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "ID")?.init, 1);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Address 1")?.address, 384);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Address 64")?.address, 510);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Data 1")?.address, 512);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Data 64")?.address, 575);
assert.equal(ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 0);
assert.equal(ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 11);
assert.equal(ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 12);
assert.equal(ICM42688_C5_IMU_FW13_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 13);
assert.equal(ICM42688_C5_IMU_FW14_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 14);
assert.equal(ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 15);
assert.equal(ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 16);
assert.equal(ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 17);
assert.equal(ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 18);
assert.equal(ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 19);
assert.equal(ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 20);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 30);
assert.equal(ICM42688_C5_IMU_FW46_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 46);
assert.equal(ICM42688_C5_IMU_FW47_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 47);
assert.equal(ICM42688_C5_IMU_FW48_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 48);
assert.equal(ICM42688_C5_IMU_FW50_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 50);
assert.equal(ICM42688_C5_IMU_FW50_CONTROL_TABLE_SCHEMA.size, 576);
assert.equal(
  ICM42688_C5_IMU_FW50_CONTROL_TABLE_SCHEMA.items.some(
    (item) => item.address >= 576,
  ),
  false,
);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMAS.length, 19);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 52);
assert.equal(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Manual Trim Command",
  )?.address,
  580,
);
const currentIcmHardwareError = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Hardware Error Status",
);
assert.equal(currentIcmHardwareError?.address, 70);
assert.deepEqual(currentIcmHardwareError?.labels, [
  "IMU Offline",
  "IMU FIFO",
  "IMU Transfer",
  "IMU Config",
  "Persistence",
  "Control Service",
  "IMU Timing",
  "IMU Data",
]);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Timestamp")?.address, 80);
assert.equal(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Orientation W",
  )?.category,
  "Legacy Compatibility State",
);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Gyro Cal Status")?.address, 130);
const currentIcmChipId = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Chip ID",
);
assert.equal(currentIcmChipId?.address, 138);
assert.deepEqual(currentIcmChipId?.labels, [
  "Unknown",
  "Reserved (retired ICM-42670P)",
  "ICM-42688P",
]);
assert.equal(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "WHO AM I")?.init,
  0x47,
);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Gyro Bias X Q20")?.address, 164);
assert.equal(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Gyro Bias X Q20",
  )?.category,
  "Gyro Calibration And Mount Alignment",
);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Roll Staging")?.address, 184);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Pitch Staging")?.address, 186);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Alignment State")?.address, 188);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Alignment Source")?.address, 189);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Alignment Result")?.address, 190);
const mountAlignmentResult = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Mount Alignment Result",
);
assert.ok(mountAlignmentResult);
assert.equal(mountAlignmentResult.length, 1);
assert.equal(mountAlignmentResult.max, 23);
assert.equal(mountAlignmentResult.labels?.at(-1), "Solution Rejected");
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Alignment Status")?.address, 192);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Alignment Command")?.address, 193);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Mount Yaw Staging")?.address, 194);
assert.equal(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Precision Level Schema",
  )?.address,
  316,
);
assert.equal(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Precision Solver Flags",
  )?.address,
  376,
);
const mountRollStaging = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Mount Roll Staging",
);
assert.ok(mountRollStaging);
assert.equal(mountRollStaging.valueType, "int");
assert.equal(mountRollStaging.unit, "deg");
assert.equal(mountRollStaging.scale, 0.01);
assert.deepEqual(
  Array.from(encodeControlTableValue(mountRollStaging, 1.24)),
  [124, 0],
);
assert.equal(
  decodeControlTableValue(
    mountRollStaging,
    Uint8Array.from([124, 0]),
  ).value,
  124,
);
assert.deepEqual(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Mount Alignment Status",
  )?.labels,
  [
    "Active Valid",
    "Collecting",
    "Motion Reject",
    "Prerequisite Invalid",
    "Dependency Invalid",
    "Reboot Required",
    "Save Error",
    "EEPROM Saved",
  ],
);
assert.deepEqual(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Mount Alignment Command",
  )?.labels,
  [
    "None",
    "Capture Quick Reference Surface",
    "Stage Identity",
    "Checked Save",
    "Checked Clear Saved",
    "Stage Manual RPY",
    "Begin Precision Level",
    "Capture Next Precision Pose",
    "Cancel Precision Level",
  ],
);
const accelCalCommand = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Accel Cal Command",
);
assert.ok(accelCalCommand);
assert.equal(accelCalCommand.address, 235);
assert.equal(accelCalCommand.length, 1);
assert.equal(accelCalCommand.max, 5);
assert.deepEqual(accelCalCommand.labels, [
  "None",
  "Capture Pose",
  "Solve",
  "Clear",
  "Save",
  "Solve and Verified Save",
]);
const accelCalRejectFlags = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Accel Cal Reject Flags",
);
assert.ok(accelCalRejectFlags);
assert.equal(accelCalRejectFlags.address, 237);
assert.equal(accelCalRejectFlags.length, 2);
assert.equal(accelCalRejectFlags.max, 65535);
assert.deepEqual(accelCalRejectFlags.labels, [
  "Offline",
  "Transfer",
  "Configuration",
  "FIFO",
  "FIFO Overflow",
  "FIFO Gap",
  "Timestamp",
  "Gyro Clipped",
  "Accel Clipped",
]);
const accelCalResult = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Accel Cal Result",
);
assert.ok(accelCalResult);
assert.equal(accelCalResult.address, 239);
assert.equal(accelCalResult.length, 1);
assert.equal(accelCalResult.max, 11);
assert.deepEqual(accelCalResult.labels, [
  "None",
  "OK",
  "Solve Rejected",
  "No Qualified Solution",
  "Persistence Not Ready",
  "Invalid Record",
  "Write Failed",
  "Readback Failed",
  "Length Mismatch",
  "Semantic Invalid",
  "Data Mismatch",
  "Invalidation Failed",
]);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Specific Force X")?.address, 96);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Sequence")?.address, 260);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Integration End Time")?.address, 264);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Integration End Time")?.length, 8);
assert.equal(
  "max" in ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Integration End Time",
  )!,
  false,
);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Integration DT")?.address, 272);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Delta Angle X Q30")?.address, 276);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Delta Velocity Z Q24")?.address, 296);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Validity Flags")?.address, 300);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Latched Fault Flags")?.address, 304);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Calibration Generation")?.address, 308);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Profile ID")?.address, 312);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Estimator Mode")?.address, 314);
assert.deepEqual(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "IMU Profile ID",
  )?.labels,
  [
    "production_1k (baseline candidate)",
    "characterization_2k",
    "characterization_4k",
    "lab_8k",
  ],
);
assert.deepEqual(
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.name === "Estimator Mode",
  )?.labels,
  [
    "Invalid",
    "Madgwick regression (non-production)",
    "VQF 6D (authoritative candidate)",
  ],
);
assert.equal(ICM42688_C5_IMU_FW48_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Production Reserved")?.address, 315);
assert.equal(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Gyro Cal Result")?.address, 315);
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name).startsWith("Linear Acceleration")));
assert.equal(ICM42688_C5_IMU_FW46_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Linear Acceleration X")?.address, 96);
for (const legacyItem of ICM42688_C5_IMU_FW46_CONTROL_TABLE_SCHEMA.items.filter((item) => item.address < 260)) {
  const currentItem = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.address === legacyItem.address,
  );
  assert.equal(currentItem?.length, legacyItem.length, `legacy item length at ${legacyItem.address}`);
  if (![96, 100, 104, 184, 186, 188, 189, 190, 192, 193].includes(legacyItem.address)) {
    assert.equal(currentItem?.name, legacyItem.name, `legacy item name at ${legacyItem.address}`);
  }
}
for (const legacyItem of ICM42688_C5_IMU_FW47_CONTROL_TABLE_SCHEMA.items.filter(
  (item) => item.address >= 84 && item.address < 124,
)) {
  const currentItem = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
    (item) => item.address === legacyItem.address,
  );
  assert.deepEqual(
    currentItem,
    legacyItem,
    `v49 must preserve the complete 84..123 ABI at ${legacyItem.address}`,
  );
}
let productionCursor = 260;
for (const item of ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.filter(
  (candidate) => candidate.address >= 260 && candidate.address < 316,
)) {
  assert.equal(item.address, productionCursor, `production block gap before ${item.name}`);
  productionCursor += item.length;
}
assert.equal(productionCursor, 316);
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Hardware Error Ignore Mask"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Hardware Error Raw"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Orientation Config Reserved"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Profile TX DMA Enable Cycle"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "ROS Timestamp"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Native Gyro X"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Filtered Gyro X Q20"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Accel Cal Reserved"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Accel Cal Reserved2"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Accel Norm Q20"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Orientation Diag Timestamp"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Orientation Diag Reserved"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Dispatch Deferred Pending"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "IMU Service Reset"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Sparse Indirect Snapshot Max Cycles"));
assert.ok(!ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL CRC Accel Mode"));
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.size, 2284);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 45);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Dispatch Deferred Pending")?.address, 1184);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Dispatch Deferred Count")?.address, 1188);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Dispatch Deferred Process Count")?.address, 1192);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Dispatch Deferred Overflow Count")?.address, 1196);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Service Rate")?.address, 1200);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Service INT1 IRQ Count")?.address, 1204);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Service Fallback Count")?.address, 1276);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Orientation DT Last")?.address, 1304);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Service Reset")?.access, "rw");
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Sparse Indirect Snapshot Max Cycles")?.address, 644);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Direct Snapshot Max Cycles")?.address, 740);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Realtime Max Chunk Count")?.address, 792);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Realtime Budget Exhausted Count")?.address, 796);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Snapshot Publish Rate")?.address, 804);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Snapshot Publish Rate")?.init, 4000);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Snapshot Publish Divider")?.init, 2);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL CRC Accel Mode")?.address, 1324);
assert.equal(ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL CRC HW 52B Cycles")?.address, 1372);
assert.equal(ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA.size, 576);
assert.equal(ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 11);
assert.equal(ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Level Cal Command")?.address, 307);
assert.ok(!ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "IMU Service Reset"));
assert.equal(ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA.size, 1260);
assert.equal(ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 12);
assert.equal(ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Service IRQ Count")?.address, 1192);
assert.ok(!ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "IMU Service INT1 IRQ Count"));
assert.equal(ICM42688_C5_IMU_FW13_CONTROL_TABLE_SCHEMA.size, 1292);
assert.equal(ICM42688_C5_IMU_FW13_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 13);
assert.equal(ICM42688_C5_IMU_FW13_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "ROS Timestamp")?.address, 160);
assert.equal(ICM42688_C5_IMU_FW14_CONTROL_TABLE_SCHEMA.size, 1292);
assert.equal(ICM42688_C5_IMU_FW14_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 14);
assert.ok(!ICM42688_C5_IMU_FW14_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Sparse Indirect Snapshot Max Cycles"));
assert.equal(ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA.size, 1292);
assert.equal(ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 15);
assert.equal(ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Sparse Indirect Snapshot Max Cycles")?.address, 644);
assert.equal(ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Gyro Bias X Q20")?.address, 168);
assert.equal(ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA.size, 1288);
assert.equal(ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 16);
assert.equal(ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Sparse Indirect Snapshot Max Cycles")?.address, 644);
assert.ok(!ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Direct Snapshot Max Cycles"));
assert.equal(ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA.size, 1288);
assert.equal(ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 17);
assert.equal(ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Direct Snapshot Max Cycles")?.address, 740);
assert.ok(!ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Realtime Max Chunk Count"));
assert.equal(ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA.size, 1288);
assert.equal(ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 18);
assert.equal(ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Realtime Max Chunk Count")?.address, 792);
assert.ok(!ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Snapshot Publish Rate"));
assert.equal(ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA.size, 1288);
assert.equal(ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 19);
assert.equal(ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Snapshot Publish Rate")?.address, 804);
assert.ok(!ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Dispatch Deferred Pending"));
assert.equal(ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA.size, 1324);

assert.equal(QC060_200_R020_RE_CONTROL_TABLE_SCHEMA.modelNumber, 8030);
assert.equal(QC080_240_R020_RE_CONTROL_TABLE_SCHEMA.modelNumber, 8050);
const qc060PresentPosition = QC060_200_R020_RE_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Present Position");
assert.equal(qc060PresentPosition?.address, 552);
assert.equal(qc060PresentPosition?.valueType, "int");
assert.equal(qc060PresentPosition?.scale, 0.0054931640625);
assert.equal(decodeControlTableValue(qc060PresentPosition!, Uint8Array.from([0xff, 0xff, 0xff, 0xff])).display, "-0.0054931640625 °");
assert.equal(ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 20);
assert.equal(ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL Dispatch Deferred Pending")?.address, 1184);
assert.equal(ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IMU Orientation DT Last")?.address, 1304);
assert.ok(!ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL CRC Accel Mode"));
assert.equal(ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 9);
assert.equal(ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Orientation Config Reserved")?.address, 306);
assert.ok(!ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Level Cal Command"));
assert.equal(getControlTableSchemaForDevice(42688), ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 9), ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 10), ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 11), ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 12), ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 13), ICM42688_C5_IMU_FW13_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 14), ICM42688_C5_IMU_FW14_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 15), ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 16), ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 17), ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 18), ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 19), ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 20), ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 21), ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 32), ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 45), ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 46), ICM42688_C5_IMU_FW46_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 47), ICM42688_C5_IMU_FW47_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 48), ICM42688_C5_IMU_FW48_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 49), ICM42688_C5_IMU_FW49_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 50), ICM42688_C5_IMU_FW50_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 51)?.minimumFirmwareVersion, 51);
assert.equal(getControlTableSchemaForDevice(42688, 51)?.items.find((item) => item.address === 70)?.labels?.[6], "-");
assert.equal(getControlTableSchemaForDevice(42688, 50)?.items.find((item) => item.address === 70)?.labels?.[7], "-");
assert.equal(getControlTableSchemaForDevice(42688, 52), ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(42688, 52)?.items.find((item) => item.address === 70)?.labels?.[6], "IMU Timing");

const integrationEndTime = ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA.items.find(
  (item) => item.name === "Integration End Time",
)!;
const maxTimestamp = 0xffff_ffff_ffff_ffffn;
const encodedMaxTimestamp = encodeControlTableValue(integrationEndTime, maxTimestamp);
assert.equal(Buffer.from(encodedMaxTimestamp).toString("hex"), "ffffffffffffffff");
assert.equal(decodeControlTableValue(integrationEndTime, encodedMaxTimestamp).value, maxTimestamp);

assert.equal(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.modelNumber, 6085);
assert.equal(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.name, "K1-BNO085-IMU");
assert.equal(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.size, 376);
assert.deepEqual(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.categories.map((category) => category.name), [
  "Core",
  "Primary Output",
  "Diagnostics",
  "Indirect Address",
  "Indirect Data",
]);
assert.ok(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => item.name === "Orientation W"));
assert.ok(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => item.name === "IMU1 Health"));
assert.ok(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => item.name === "UART ORE Count"));
assert.ok(K1_BNO085_IMU_CONTROL_TABLE_SCHEMA.items.some((item) => item.name === "UART Last TX Start Idle Delta Cycles"));

assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.modelNumber, 5105);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.name, "K1 HAT C5");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.size, 1588);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.length, 804);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "ID")?.init, 1);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "ID")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 34);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Baud Rate (Bus)")?.init, 8);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Baud Rate (Bus)")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Return Delay Time")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Status Return Level")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "DXL TX Mode")?.address, 316);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Passthrough State")?.access, "r");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Passthrough Host Overflow Count")?.address, 306);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "UART RX Overflow Dropped Bytes")?.address, 380);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS Stale Timeout")?.access, "rw");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS Enable")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS CRSF Mirror Enable")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS Baud Rate")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS Poll Period")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS Stale Timeout")?.memory, "eeprom");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS Raw Fault")?.access, "r");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "BMS MODBUS Exception Count")?.address, 428);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "CRSF TX Byte Count")?.address, 432);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "CRSF TX Drop Count")?.address, 436);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "CRSF RX Overflow Count")?.address, 440);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "CRSF RX Overflow Count")?.access, "r");
const k1SystemStatus = K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "System Status State");
assert.ok(k1SystemStatus);
assert.equal(formatControlTableValue(k1SystemStatus, 8), "8 (BMS Fault)");
const k1SystemStatusFlags = K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "System Status Flags");
assert.ok(k1SystemStatusFlags);
assert.equal(formatControlTableValue(k1SystemStatusFlags, 1 << 8), "256 (BMS Fault)");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "CRSF Flight Mode"), false);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => Number(item.address) === 312), false);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "Registered Instruction"), false);
const k1HardwareError = K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => String(item.name) === "Hardware Error Status");
assert.equal(k1HardwareError?.address, 70);
assert.equal(k1HardwareError?.length, 1);
assert.equal(k1HardwareError?.access, "r");
assert.equal(k1HardwareError?.memory, "ram");
assert.ok(k1HardwareError);
assert.equal(formatControlTableValue(k1HardwareError, 1), "1 (BMS Battery Fault)");
assert.equal(formatControlTableValue(k1HardwareError, 2), "2 (DXL Transport Fault)");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "DXL Profile Reset Timing"), false);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "BMS Remaining Capacity"), false);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "BMS Remaining Energy"), false);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Address Write 1")?.address, 512);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Address Write 64")?.address, 638);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Address Read 1")?.address, 640);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Address Read 256")?.address, 1150);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Data Write 1")?.address, 1152);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Data Write 64")?.address, 1215);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Data Read 1")?.address, 1216);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Data Read 1")?.access, "rw");
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Indirect Data Read 256")?.address, 1471);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.categories.find((category) => category.name === "Indirect Address Write")?.items.length, 64);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.categories.find((category) => category.name === "Indirect Address Read")?.items.length, 256);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.categories.find((category) => category.name === "Indirect Data Write")?.items.length, 64);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.categories.find((category) => category.name === "Indirect Data Read")?.items.length, 256);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Fault Log Format Version")?.address, 1472);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Fault Log Selected Record")?.length, 64);
assert.equal(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Fault Log Clear Command")?.address, 1584);
assert.equal(getControlTableSchemaForDevice(5105), K1_HAT_C5_CONTROL_TABLE_SCHEMA);

assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "ID")?.init, 1);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 28);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.minimumFirmwareVersion, 22);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.size, 832);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMAS.length, 8);
assert.equal(E2D2_H5_LEGACY_CONTROL_TABLE_SCHEMA.size, 60);
assert.equal(E2D2_H5_LEGACY_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Firmware Version")?.init, 10);
assert.equal(getControlTableSchemaForDevice(6050, 10), E2D2_H5_LEGACY_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 13), E2D2_H5_FW13_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 14), E2D2_H5_FW13_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 15), E2D2_H5_FW15_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 16), E2D2_H5_FW15_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 17), E2D2_H5_FW17_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 18), E2D2_H5_FW17_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 19), E2D2_H5_FW19_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 20), E2D2_H5_FW19_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 21), E2D2_H5_FW21_CONTROL_TABLE_SCHEMA);
assert.equal(getControlTableSchemaForDevice(6050, 22), E2D2_H5_CONTROL_TABLE_SCHEMA);
assert.equal(E2D2_H5_FW15_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IP Address")?.init, 3232238081);
assert.equal(E2D2_H5_FW21_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IP Address")?.init, 3232286721);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IP Address")?.init, 3232286920);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Gateway")?.init, 3232286721);

const h5IpAddress = E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "IP Address");
assert.ok(h5IpAddress);
assert.equal(isIpv4ControlTableItem(h5IpAddress), true);
assert.equal(
  decodeControlTableValue(h5IpAddress, Uint8Array.from([192, 168, 200, 200])).display,
  "192.168.200.200",
);
assert.deepEqual(
  Array.from(encodeControlTableValue(h5IpAddress, "192.168.200.200")),
  [192, 168, 200, 200],
);
assert.throws(
  () => encodeControlTableValue(h5IpAddress, "192.168.200.999"),
  /IPv4 octets must be in \[0, 255\]/,
);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Baud Rate (Bus)")?.init, 8);
for (let channel = 1; channel <= 5; channel += 1) {
  assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === `DXL ${channel} Baud Rate`)?.init, 8);
}
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "C5 Link Baud Rate")?.init, 8);
for (let socket = 1; socket <= 6; socket += 1) {
  const name = socket === 6 ? "C5 Link Socket Protocol" : `Socket ${socket} Protocol`;
  assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === name)?.init, 1);
}
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "C5 Link Applied Baud Rate")?.address, 60);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "C5 Link Baud Apply Pending")?.address, 61);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "C5 Link Baud Apply Count")?.address, 64);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "VCP Requested Route")?.address, 68);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "VCP Requested Route")?.access, "rw");
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "VCP Applied Route")?.access, "r");
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "VCP Route Reject Count")?.address, 76);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Control CDC Signature")?.address, 620);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Control CDC Backpressure Count")?.access, "r");
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Control CDC Pending High Water")?.address, 638);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Fault Log Format Version")?.address, 640);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Fault Log Selected Record")?.length, 64);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Fault Log Clear Command")?.address, 752);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "C5 Transport Profile Version")?.address, 768);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "C5 Transport Ambiguous Delivery Count")?.address, 780);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "C5 Transport Budget Violation Count")?.address, 796);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Service Socket Profile Version")?.address, 800);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Service Socket Ambiguous Send Count")?.address, 816);
assert.equal(E2D2_H5_CONTROL_TABLE_SCHEMA.items.find((item) => item.name === "Service Socket Budget Violation Count")?.address, 828);
assert.equal(E2D2_H5_FW19_CONTROL_TABLE_SCHEMA.size, 800);
assert.ok(!E2D2_H5_FW19_CONTROL_TABLE_SCHEMA.items.some((item) => item.address >= 800));
assert.equal(E2D2_H5_FW17_CONTROL_TABLE_SCHEMA.size, 756);
assert.ok(!E2D2_H5_FW17_CONTROL_TABLE_SCHEMA.items.some((item) => item.address >= 768));

const byName = (name: string) => {
  const item = K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.find((candidate) => candidate.name === name);
  assert.ok(item, `${name} exists`);
  return item;
};

const byCategory = (name: string) => {
  const category = K1_HAT_C5_CONTROL_TABLE_SCHEMA.categories.find((candidate) => candidate.name === name);
  assert.ok(category, `${name} category exists`);
  return category;
};

assert.equal(
  K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((candidate) => String(candidate.name) === "Bootloader Command"),
  false,
);
assert.ok(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "UART RX Error Count"));
assert.ok(K1_HAT_C5_CONTROL_TABLE_SCHEMA.items.some((item) => String(item.name) === "UART TX Error Count"));
assert.equal(byName("Firmware Version").init, 34);
assert.equal(byName("Indirect Address Write 1").address, 512);
assert.equal(byName("Indirect Address Write 64").address, 638);
assert.equal(byName("Indirect Address Read 1").address, 640);
assert.equal(byName("Indirect Address Read 256").address, 1150);
assert.equal(byName("Indirect Data Write 1").address, 1152);
assert.equal(byName("Indirect Data Write 64").address, 1215);
assert.equal(byName("Indirect Data Read 1").address, 1216);
assert.equal(byName("Indirect Data Read 256").address, 1471);
assert.equal(byCategory("Indirect Address Write").items.length, 64);
assert.equal(byCategory("Indirect Address Read").items.length, 256);
assert.equal(byCategory("Indirect Data Write").items.length, 64);
assert.equal(byCategory("Indirect Data Read").items.length, 256);

const baud = byName("Baud Rate (Bus)");
assert.equal(baud.address, 8);
assert.equal(baud.access, "rw");
assert.equal(baud.labels?.[2], "115200 bps");
assert.equal(formatControlTableValue(baud, 2), "2 (115200 bps)");

const returnDelay = byName("Return Delay Time");
assert.equal(decodeControlTableValue(returnDelay, Uint8Array.from([5])).display, "10 usec");
assert.deepEqual(Array.from(encodeControlTableValue(returnDelay, 10)), [5]);

const ledMode = byName("LED Mode");
assert.equal(ledMode.address, 100);
assert.equal(formatControlTableValue(ledMode, 2), "2 (Status Auto)");
assert.deepEqual(byCategory("LED").items.map((item) => item.name), [
  "LED Mode",
  "User LED Brightness",
  "User LED Red",
  "User LED Green",
  "User LED Blue",
  "Status LED Policy",
  "NeoPixel Count",
]);
assert.deepEqual(byCategory("LED").items.map((item) => item.address), [100, 101, 102, 103, 104, 105, 106]);

const systemStatus = byName("System Status State");
assert.equal(systemStatus.address, 109);
assert.equal(formatControlTableValue(systemStatus, 3), "3 (ELRS Failsafe)");

const realtimeTick = byName("Realtime Tick");
assert.equal(realtimeTick.address, 296);
assert.equal(realtimeTick.length, 2);
assert.equal(realtimeTick.access, "r");
assert.equal(realtimeTick.unit, "ms");

const estopActive = byName("E-stop Active");
assert.equal(estopActive.address, 298);
assert.equal(estopActive.length, 1);
assert.equal(estopActive.access, "r");
assert.equal(formatControlTableValue(estopActive, 1), "1 (Active)");

const fetPwmDuty = byName("FET PWM Duty");
assert.equal(fetPwmDuty.address, 299);
assert.equal(fetPwmDuty.length, 2);
assert.equal(fetPwmDuty.unit, "counts");

const estopPinLevel = byName("E-stop Pin Level");
assert.equal(estopPinLevel.address, 302);
assert.equal(estopPinLevel.length, 1);
assert.equal(formatControlTableValue(estopPinLevel, 1), "1 (High)");

const uartRxOverflow = byName("UART RX Overflow Count");
assert.equal(uartRxOverflow.address, 96);

const snr = byName("CRSF SNR");
assert.equal(decodeControlTableValue(snr, Uint8Array.from([0xff])).value, -1);
assert.deepEqual(Array.from(encodeControlTableValue(snr, -2)), [0xfe]);

const flags = byName("CRSF Telemetry Flags");
assert.equal(formatControlTableValue(flags, 3), "3");

const passthroughTarget = byName("Passthrough Target");
assert.equal(passthroughTarget.address, 112);
assert.equal(passthroughTarget.access, "rw");
assert.deepEqual(getControlTableLabelOptions(passthroughTarget), [
  { value: 0, label: "None/DXL" },
  { value: 1, label: "REMOTE ELRS" },
  { value: 2, label: "BMS RS485" },
]);

const passthroughCommand = byName("Passthrough Command");
assert.equal(passthroughCommand.address, 114);
assert.equal(formatControlTableValue(passthroughCommand, 225), "225 (Enter)");
assert.deepEqual(getControlTableLabelOptions(passthroughCommand), [
  { value: 224, label: "Exit" },
  { value: 225, label: "Enter" },
]);

// Exercise the generic ASCII codec independently of retired product registers.
const flightMode = { name: "Flight Mode", address: 0, length: 16, access: "rw", memory: "ram", category: "Codec fixture", valueType: "ascii" } as const;
assert.equal(decodeControlTableValue(flightMode, Uint8Array.from([65, 78, 71, 76, 69, 0])).value, "ANGLE");
assert.deepEqual(Array.from(encodeControlTableValue(flightMode, "ACRO")).slice(0, 5), [65, 67, 82, 79, 0]);

const bmsCurrent = byName("BMS Current");
assert.equal(bmsCurrent.address, 278);
assert.equal(bmsCurrent.valueType, "int");
assert.equal(decodeControlTableValue(bmsCurrent, Uint8Array.from([0x38, 0xff])).value, -200);

const bmsTemperature = byName("BMS Temperature");
assert.equal(bmsTemperature.address, 282);
assert.equal(bmsTemperature.unit, "C");
assert.equal(bmsTemperature.scale, 0.1);
assert.equal(decodeControlTableValue(bmsTemperature, Uint8Array.from([0xf9, 0x00])).display, "24.9 C");
assert.equal(decodeControlTableValue(bmsTemperature, Uint8Array.from([0xfa, 0x00])).display, "25.0 C");
assert.deepEqual(Array.from(encodeControlTableValue(bmsTemperature, 25.0)), [250, 0]);

const blocks = planControlTableReadBlocks(K1_HAT_C5_CONTROL_TABLE_SCHEMA);
assert.deepEqual(blocks, [
  { address: 0, length: 160 },
  { address: 160, length: 160 },
  { address: 320, length: 160 },
  { address: 480, length: 160 },
  { address: 640, length: 160 },
  { address: 800, length: 160 },
  { address: 960, length: 160 },
  { address: 1120, length: 160 },
  { address: 1280, length: 160 },
  { address: 1440, length: 148 },
]);
assert.deepEqual(planControlTableReadBlocks(K1_HAT_C5_CONTROL_TABLE_SCHEMA, { maxBlockLength: K1_HAT_C5_CONTROL_TABLE_SCHEMA.size }), [
  { address: 0, length: 1588 },
]);

// Retired product IDs must no longer resolve to active device support.
for (const modelNumber of [5005, 6040]) {
  assert.equal(getControlTableSchemaForDevice(modelNumber), null);
  assert.equal(getControlTableSchemaForDevice(modelNumber, 27), null);
  assert.equal(getKnownDeviceName(modelNumber), `Model ${modelNumber}`);
  assert.deepEqual(createKnownDevice(modelNumber, {} as DynamixelClient), { kind: "unknown", modelNumber });
}

// Firmware identity metadata must follow the application actually built.
for (const [project, schema] of [
  ["openrb_usb2dxl", OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA],
  ["openrb_elrs", OPENRB_CRSF_CONTROL_TABLE_SCHEMA],
] as const) {
  const config = readFileSync(new URL(`../../../projects/${project}/include/config.h`, import.meta.url), "utf8");
  const version = config.match(/^#define\s+FIRMWARE_VERSION\s+(\d+)/m);
  assert.ok(version, `${project} must declare a firmware version`);
  assert.equal(schema.items.find(item => item.name === "Firmware Version")?.init, Number(version[1]), `${project} firmware metadata must match its image`);
}

console.log("control table tests ok");
