import type { DynamixelClient } from "../dynamixel-client.js";
import { selectControlTableSchemaVariant, type ControlTableSchema } from "../control-table.js";
import {
  E2D2_H5_CONTROL_TABLE_SCHEMA,
  E2D2_H5_CONTROL_TABLE_SCHEMAS,
} from "../generated/e2d2-h5-control-table.js";
import {
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA,
  ICM42688_C5_IMU_CONTROL_TABLE_SCHEMAS,
} from "../generated/icm42688-c5-imu-control-table.js";
import {
  K1_IMU_REV07_CONTROL_TABLE_SCHEMA,
  K1_IMU_REV07_FW55_CONTROL_TABLE_SCHEMA,
  K1_IMU_REV07_CONTROL_TABLE_SCHEMAS,
} from "../generated/k1-imu-rev07-control-table.js";
import { K1_BNO085_IMU_CONTROL_TABLE_SCHEMA } from "../generated/k1-bno085-imu-control-table.js";
import { K1_HAT_C5_CONTROL_TABLE_SCHEMA } from "../generated/k1-hat-c5-control-table.js";
import { K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMAS,
  K1_HAT_C5_REV06_FW36_CONTROL_TABLE_SCHEMA } from "../generated/k1-hat-c5-rev06-control-table.js";
import { OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA } from "../generated/opencr-neopixel-dxl-control-table.js";
import { OPENRB_CRSF_CONTROL_TABLE_SCHEMA } from "../generated/openrb-crsf-control-table.js";
import { OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA } from "../generated/openrb-usb2dxl-control-table.js";
import { QC060_200_R020_RE_CONTROL_TABLE_SCHEMA } from "../generated/qc060-200-r020-re-control-table.js";
import { QC080_240_R020_RE_CONTROL_TABLE_SCHEMA } from "../generated/qc080-240-r020-re-control-table.js";
import { QDD_Q1_CONTROL_TABLE_SCHEMA } from "../generated/qdd-q1-control-table.js";
import { QDD_Q3_CONTROL_TABLE_SCHEMA } from "../generated/qdd-q3-control-table.js";
import { E2D2H5Device, E2D2_H5_MODEL_NUMBER } from "./e2d2-h5.js";

export const K1_BNO085_IMU_MODEL_NUMBER = 6085;
export const K1_HAT_C5_MODEL_NUMBER = 5105;
export const OPENRB_USB2DXL_MODEL_NUMBER = 6030;
export const OPENRB_CRSF_MODEL_NUMBER = 6031;
export const OPENCR_NEOPIXEL_DXL_MODEL_NUMBER = 6043;
export const ICM42688_C5_IMU_MODEL_NUMBER = 42688;
export const K1_IMU_REV07_MODEL_NUMBER = 42689;

const K1_IMU_REV07_PRE_RAW_SCHEMA: ControlTableSchema = {
  ...K1_IMU_REV07_FW55_CONTROL_TABLE_SCHEMA,
  minimumFirmwareVersion: 52,
  size: 624,
  items: K1_IMU_REV07_FW55_CONTROL_TABLE_SCHEMA.items.filter((item) => item.address < 624),
  categories: K1_IMU_REV07_FW55_CONTROL_TABLE_SCHEMA.categories
    .map((category) => ({...category, items: category.items.filter((item) => item.address < 624)}))
    .filter((category) => category.items.length > 0),
};

export function isIcm42688ImuModel(modelNumber: number): boolean {
  return modelNumber === ICM42688_C5_IMU_MODEL_NUMBER ||
    modelNumber === K1_IMU_REV07_MODEL_NUMBER;
}
export const QDD_Q1_MODEL_NUMBER = 8000;
export const QDD_Q3_MODEL_NUMBER = 8020;
export const QC060_200_R020_RE_MODEL_NUMBER = 8030;
export const QC080_240_R020_RE_MODEL_NUMBER = 8050;

// FW35..38 overlaps legacy feature-group and early REV06. Expose only the
// shared table, without claiming a physical revision or optional extensions.
const K1_HAT_C5_REVISION_UNVERIFIED_SCHEMA: ControlTableSchema = {
  ...K1_HAT_C5_REV06_FW36_CONTROL_TABLE_SCHEMA,
  name: "K1 HAT C5 (revision unverified)",
};

type QddModelNumber =
  | typeof QDD_Q1_MODEL_NUMBER
  | typeof QDD_Q3_MODEL_NUMBER
  | typeof QC060_200_R020_RE_MODEL_NUMBER
  | typeof QC080_240_R020_RE_MODEL_NUMBER;

const QDD_CONTROL_TABLE_SCHEMAS = [
  QDD_Q1_CONTROL_TABLE_SCHEMA,
  QDD_Q3_CONTROL_TABLE_SCHEMA,
  QC060_200_R020_RE_CONTROL_TABLE_SCHEMA,
  QC080_240_R020_RE_CONTROL_TABLE_SCHEMA,
] as const;


export type KnownDevice =
  | { kind: "k1_hat_c5"; modelNumber: typeof K1_HAT_C5_MODEL_NUMBER }
  | { kind: "e2d2_h5"; modelNumber: typeof E2D2_H5_MODEL_NUMBER; device: E2D2H5Device }
  | { kind: "openrb_usb2dxl"; modelNumber: typeof OPENRB_USB2DXL_MODEL_NUMBER }
  | { kind: "openrb_crsf"; modelNumber: typeof OPENRB_CRSF_MODEL_NUMBER }
  | { kind: "opencr_neopixel_dxl"; modelNumber: typeof OPENCR_NEOPIXEL_DXL_MODEL_NUMBER }
  | { kind: "k1_bno085_imu"; modelNumber: typeof K1_BNO085_IMU_MODEL_NUMBER }
  | { kind: "icm42688_c5_imu"; modelNumber: typeof ICM42688_C5_IMU_MODEL_NUMBER }
  | { kind: "k1_imu_rev07"; modelNumber: typeof K1_IMU_REV07_MODEL_NUMBER }
  | { kind: "qdd"; modelNumber: QddModelNumber }
  | { kind: "unknown"; modelNumber: number };

function isQddModelNumber(modelNumber: number): modelNumber is QddModelNumber {
  return QDD_CONTROL_TABLE_SCHEMAS.some((schema) => schema.modelNumber === modelNumber);
}

export function createKnownDevice(modelNumber: number, dxl: DynamixelClient): KnownDevice {
  if (modelNumber === K1_HAT_C5_MODEL_NUMBER) {
    return { kind: "k1_hat_c5", modelNumber };
  }
  if (modelNumber === E2D2_H5_MODEL_NUMBER) {
    return { kind: "e2d2_h5", modelNumber, device: new E2D2H5Device(dxl) };
  }
  if (modelNumber === OPENRB_USB2DXL_MODEL_NUMBER) {
    return { kind: "openrb_usb2dxl", modelNumber };
  }
  if (modelNumber === OPENRB_CRSF_MODEL_NUMBER) {
    return { kind: "openrb_crsf", modelNumber };
  }
  if (modelNumber === OPENCR_NEOPIXEL_DXL_MODEL_NUMBER) {
    return { kind: "opencr_neopixel_dxl", modelNumber };
  }
  if (modelNumber === K1_BNO085_IMU_MODEL_NUMBER) {
    return { kind: "k1_bno085_imu", modelNumber };
  }
  if (modelNumber === ICM42688_C5_IMU_MODEL_NUMBER) {
    return { kind: "icm42688_c5_imu", modelNumber };
  }
  if (modelNumber === K1_IMU_REV07_MODEL_NUMBER) {
    return { kind: "k1_imu_rev07", modelNumber };
  }
  if (isQddModelNumber(modelNumber)) {
    return { kind: "qdd", modelNumber };
  }
  return { kind: "unknown", modelNumber };
}

export function getKnownDeviceName(modelNumber: number): string {
  if (modelNumber === K1_HAT_C5_MODEL_NUMBER) {
    return "K1 HAT C5";
  }
  if (modelNumber === E2D2_H5_MODEL_NUMBER) {
    return "E2D2 H5";
  }
  if (modelNumber === OPENRB_USB2DXL_MODEL_NUMBER) {
    return "OpenRB USB2DXL";
  }
  if (modelNumber === OPENRB_CRSF_MODEL_NUMBER) {
    return "OpenRB CRSF";
  }
  if (modelNumber === OPENCR_NEOPIXEL_DXL_MODEL_NUMBER) {
    return "OpenCR NeoPixel DXL";
  }
  if (modelNumber === K1_BNO085_IMU_MODEL_NUMBER) {
    return "K1 BNO085 IMU";
  }
  if (modelNumber === ICM42688_C5_IMU_MODEL_NUMBER) {
    return "ICM42688 C5 IMU";
  }
  if (modelNumber === K1_IMU_REV07_MODEL_NUMBER) {
    return "K1 IMU REV07";
  }
  switch (modelNumber) {
    case QDD_Q1_MODEL_NUMBER:
      return "QDD Q1";
    case QDD_Q3_MODEL_NUMBER:
      return "QDD Q3";
    case QC060_200_R020_RE_MODEL_NUMBER:
      return "QC060-200-R020-RE";
    case QC080_240_R020_RE_MODEL_NUMBER:
      return "QC080-240-R020-RE";
    default:
      break;
  }
  return `Model ${modelNumber}`;
}

export function getControlTableSchemaForModel(modelNumber: number): ControlTableSchema | null {
  return getControlTableSchemaForDevice(modelNumber);
}

export function getControlTableSchemaForDevice(modelNumber: number, firmwareVersion?: number): ControlTableSchema | null {
  if (modelNumber === K1_HAT_C5_MODEL_NUMBER) {
    if (firmwareVersion != null && firmwareVersion >= 39)
      return selectControlTableSchemaVariant(K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMAS, firmwareVersion);
    if (firmwareVersion != null && firmwareVersion >= 35)
      return K1_HAT_C5_REVISION_UNVERIFIED_SCHEMA;
    return K1_HAT_C5_CONTROL_TABLE_SCHEMA;
  }
  if (modelNumber === E2D2_H5_MODEL_NUMBER) {
    if (firmwareVersion == null) return E2D2_H5_CONTROL_TABLE_SCHEMA;
    return selectControlTableSchemaVariant(E2D2_H5_CONTROL_TABLE_SCHEMAS, firmwareVersion);
  }
  if (modelNumber === OPENRB_USB2DXL_MODEL_NUMBER) {
    return OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA;
  }
  if (modelNumber === OPENRB_CRSF_MODEL_NUMBER) {
    return OPENRB_CRSF_CONTROL_TABLE_SCHEMA;
  }
  if (modelNumber === OPENCR_NEOPIXEL_DXL_MODEL_NUMBER) {
    return OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA;
  }
  if (modelNumber === K1_BNO085_IMU_MODEL_NUMBER) {
    return K1_BNO085_IMU_CONTROL_TABLE_SCHEMA;
  }
  if (modelNumber === ICM42688_C5_IMU_MODEL_NUMBER) {
    if (firmwareVersion == null) return ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA;
    return selectControlTableSchemaVariant(ICM42688_C5_IMU_CONTROL_TABLE_SCHEMAS, firmwareVersion);
  }
  if (modelNumber === K1_IMU_REV07_MODEL_NUMBER) {
    if (firmwareVersion !== undefined && firmwareVersion < 55) return K1_IMU_REV07_PRE_RAW_SCHEMA;
    if (firmwareVersion == null) return K1_IMU_REV07_CONTROL_TABLE_SCHEMA;
    return selectControlTableSchemaVariant(K1_IMU_REV07_CONTROL_TABLE_SCHEMAS, firmwareVersion);
  }
  const qddSchema = QDD_CONTROL_TABLE_SCHEMAS.find((schema) => schema.modelNumber === modelNumber);
  if (qddSchema) {
    return qddSchema;
  }
  return null;
}
