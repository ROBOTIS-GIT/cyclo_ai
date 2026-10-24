import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkOnly = process.argv.includes("--check");
const schemas = [
  {
    variants: [
      {
        input: resolve(root, "projects/k1_hat_rev06/board_fw36.xml"),
        exportName: "K1_HAT_C5_REV06_FW36_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_rev06/board_fw41.xml"),
        exportName: "K1_HAT_C5_REV06_FW41_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_rev06/board.xml"),
        exportName: "K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA",
      },
    ],
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/k1-hat-c5-rev06-control-table.ts"),
    exportName: "K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA",
    variantsExportName: "K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMAS",
  },
  {
    input: resolve(root, "projects/k1_hat/board.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/k1-hat-c5-control-table.ts"),
    exportName: "K1_HAT_C5_CONTROL_TABLE_SCHEMA",
  },
  {
    variants: [
      {
        input: resolve(root, "projects/e2d2/E2D2_H5.xml"),
        exportName: "E2D2_H5_LEGACY_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_h5/E2D2_H5_fw13.xml"),
        exportName: "E2D2_H5_FW13_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_h5/E2D2_H5_fw15.xml"),
        exportName: "E2D2_H5_FW15_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_h5/E2D2_H5_fw17.xml"),
        exportName: "E2D2_H5_FW17_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_h5/E2D2_H5_fw19.xml"),
        exportName: "E2D2_H5_FW19_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_h5/E2D2_H5_fw21.xml"),
        exportName: "E2D2_H5_FW21_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_h5/E2D2_H5.xml"),
        exportName: "E2D2_H5_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/k1_hat_h5_rev06/E2D2_H5.xml"),
        exportName: "K1_HAT_H5_REV06_CONTROL_TABLE_SCHEMA",
      },
    ],
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/e2d2-h5-control-table.ts"),
    exportName: "E2D2_H5_CONTROL_TABLE_SCHEMA",
    variantsExportName: "E2D2_H5_CONTROL_TABLE_SCHEMAS",
  },
  // The K1 BNO085 firmware source was removed in 2026-07. Its generated schema
  // remains checked in only for legacy dashboard compatibility, so it is not
  // regenerated here.
  {
    variants: [
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw0.xml"),
        exportName: "ICM42688_C5_IMU_FW0_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw11.xml"),
        exportName: "ICM42688_C5_IMU_FW11_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw12.xml"),
        exportName: "ICM42688_C5_IMU_FW12_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw13.xml"),
        exportName: "ICM42688_C5_IMU_FW13_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw14.xml"),
        exportName: "ICM42688_C5_IMU_FW14_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw15.xml"),
        exportName: "ICM42688_C5_IMU_FW15_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw16.xml"),
        exportName: "ICM42688_C5_IMU_FW16_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw17.xml"),
        exportName: "ICM42688_C5_IMU_FW17_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw18.xml"),
        exportName: "ICM42688_C5_IMU_FW18_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw19.xml"),
        exportName: "ICM42688_C5_IMU_FW19_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw20.xml"),
        exportName: "ICM42688_C5_IMU_FW20_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw45.xml"),
        exportName: "ICM42688_C5_IMU_FW45_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw46.xml"),
        exportName: "ICM42688_C5_IMU_FW46_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw47.xml"),
        exportName: "ICM42688_C5_IMU_FW47_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw48.xml"),
        exportName: "ICM42688_C5_IMU_FW48_CONTROL_TABLE_SCHEMA",
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/xml/ICM42688_C5_IMU_fw48.xml"),
        exportName: "ICM42688_C5_IMU_FW49_CONTROL_TABLE_SCHEMA",
        derive: deriveIcm42688Firmware49,
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/ICM42688_C5_IMU.xml"),
        exportName: "ICM42688_C5_IMU_FW50_CONTROL_TABLE_SCHEMA",
        derive: deriveIcm42688Firmware50,
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/ICM42688_C5_IMU.xml"),
        exportName: "ICM42688_C5_IMU_FW51_CONTROL_TABLE_SCHEMA",
        derive: deriveIcm42688Firmware51,
      },
      {
        input: resolve(root, "projects/icm42688_c5_imu/ICM42688_C5_IMU.xml"),
        exportName: "ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA",
      },
    ],
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/icm42688-c5-imu-control-table.ts"),
    exportName: "ICM42688_C5_IMU_CONTROL_TABLE_SCHEMA",
    variantsExportName: "ICM42688_C5_IMU_CONTROL_TABLE_SCHEMAS",
  },
  {
    input: resolve(root, "projects/k1_imu_rev07/K1_IMU_REV07.xml"),
    variants: [
      {
        input: resolve(root, "projects/k1_imu_rev07/K1_IMU_REV07.xml"),
        exportName: "K1_IMU_REV07_FW55_CONTROL_TABLE_SCHEMA",
        derive: deriveRev07Firmware55,
      },
      {
        input: resolve(root, "projects/k1_imu_rev07/K1_IMU_REV07.xml"),
        exportName: "K1_IMU_REV07_CONTROL_TABLE_SCHEMA",
      },
    ],
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/k1-imu-rev07-control-table.ts"),
    exportName: "K1_IMU_REV07_CONTROL_TABLE_SCHEMA",
    variantsExportName: "K1_IMU_REV07_CONTROL_TABLE_SCHEMAS",
  },
  {
    input: resolve(root, "projects/opencr_neopixel_dxl/OPENCR_NEOPIXEL_DXL.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/opencr-neopixel-dxl-control-table.ts"),
    exportName: "OPENCR_NEOPIXEL_DXL_CONTROL_TABLE_SCHEMA",
  },
  {
    input: resolve(root, "projects/openrb_elrs/OPENRB_CRSF.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/openrb-crsf-control-table.ts"),
    exportName: "OPENRB_CRSF_CONTROL_TABLE_SCHEMA",
  },
  {
    input: resolve(root, "projects/openrb_usb2dxl/OPENRB_USB2DXL.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/openrb-usb2dxl-control-table.ts"),
    exportName: "OPENRB_USB2DXL_CONTROL_TABLE_SCHEMA",
  },
  {
    input: resolve(root, "tools/cyclo_firmware_sdk/xml/qdd/QDD_Q1.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/qdd-q1-control-table.ts"),
    exportName: "QDD_Q1_CONTROL_TABLE_SCHEMA",
  },
  {
    input: resolve(root, "tools/cyclo_firmware_sdk/xml/qdd/QC060-200-R020-RE.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/qc060-200-r020-re-control-table.ts"),
    exportName: "QC060_200_R020_RE_CONTROL_TABLE_SCHEMA",
  },
  {
    input: resolve(root, "tools/cyclo_firmware_sdk/xml/qdd/QDD_Q3.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/qdd-q3-control-table.ts"),
    exportName: "QDD_Q3_CONTROL_TABLE_SCHEMA",
  },
  {
    input: resolve(root, "tools/cyclo_firmware_sdk/xml/qdd/QC080-240-R020-RE.xml"),
    output: resolve(root, "tools/cyclo_firmware_sdk/src/generated/qc080-240-r020-re-control-table.ts"),
    exportName: "QC080_240_R020_RE_CONTROL_TABLE_SCHEMA",
  },
];

let stale = false;
for (const config of schemas) {
  const variants = config.variants ?? [{ input: config.input, exportName: config.exportName }];
  const schemas = [];
  for (const variant of variants) {
    schemas.push({
      exportName: variant.exportName,
      schema: variant.derive
        ? variant.derive(await readSchema(variant.input))
        : await readSchema(variant.input),
    });
  }
  const schemaSource = schemas
    .map(({ exportName, schema }) => `export const ${exportName} = ${JSON.stringify(schema, null, 2)} as const satisfies ControlTableSchema;`)
    .join("\n\n");
  const variantsSource = config.variantsExportName
    ? `\n\nexport const ${config.variantsExportName}: readonly ControlTableSchema[] = [${schemas.map(({ exportName }) => exportName).join(", ")}];`
    : "";
  const source = `// Generated by scripts/generate-control-table-schema.mjs. Do not edit by hand.
import type { ControlTableSchema } from "../control-table.js";

${schemaSource}${variantsSource}
`;

  if (checkOnly) {
    const current = await readFile(config.output, "utf8").catch(() => "");
    if (current !== source) {
      console.error(`stale control-table schema: ${config.output}`);
      stale = true;
    }
  } else {
    await mkdir(dirname(config.output), { recursive: true });
    await writeFile(config.output, source);
    console.log(`generated ${config.output}`);
  }
}

if (stale) {
  process.exitCode = 1;
}

/*
 * Firmware 49 changed only the exact persistence-result byte at address 315,
 * the hardware-error labels, and the advertised firmware floor. Keeping this
 * small deterministic derivation avoids duplicating the otherwise identical
 * 350-line v48 XML while preserving correct schema selection for deployed v49
 * devices after v50 becomes current.
 */
function deriveIcm42688Firmware49(source) {
  const schema = structuredClone(source);
  schema.minimumFirmwareVersion = 49;
  const firmware = schema.items.find((item) => item.address === 6);
  const hardwareError = schema.items.find((item) => item.address === 70);
  const result = schema.items.find((item) => item.address === 315);
  if (!firmware || !hardwareError || !result) {
    throw new Error("ICM42688 firmware-49 derivation source is incomplete");
  }
  firmware.init = 49;
  hardwareError.labels = [
    "IMU Offline",
    "IMU FIFO",
    "IMU Transfer",
    "IMU Config",
    "Persistence",
    "Control Service",
    "-",
    "-",
  ];
  result.name = "Gyro Cal Result";
  result.max = 10;
  result.multi = true;
  result.ui = 3;
  result.labels = [
    "None",
    "OK",
    "Precondition Rejected",
    "Persistence Not Ready",
    "Invalid Record",
    "Write Failed",
    "Readback Failed",
    "Length Mismatch",
    "Semantic Invalid",
    "Data Mismatch",
    "Invalidation Failed",
  ];
  return schema;
}

/*
 * Firmware 51 appends the independent manual-trim block at 576..623.
 * Derive the deployed firmware-50 schema from the current XML so schema
 * selection never exposes v51-only addresses to an older device.
 */
function deriveIcm42688Firmware50(source) {
  const schema = deriveIcm42688Firmware51(source);
  schema.minimumFirmwareVersion = 50;
  schema.size = 576;
  schema.items = schema.items.filter((item) => item.address < 576);
  schema.categories = schema.categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => item.address < 576),
    }))
    .filter((category) => category.items.length > 0);
  const firmware = schema.items.find((item) => item.address === 6);
  if (!firmware) {
    throw new Error("ICM42688 firmware-50 derivation source is incomplete");
  }
  firmware.init = 50;
  return schema;
}

function deriveIcm42688Firmware51(source) {
  const schema = structuredClone(source);
  schema.minimumFirmwareVersion = 51;
  const firmware = schema.items.find((item) => item.address === 6);
  const hardware = schema.items.find((item) => item.address === 70);
  if (!firmware || !hardware) throw new Error("ICM42688 firmware-51 derivation is incomplete");
  firmware.init = 51;
  hardware.labels = [...hardware.labels.slice(0, 6), "-", "-"];
  return schema;
}

function deriveRev07Firmware55(source) {
  const schema = structuredClone(source);
  schema.minimumFirmwareVersion = 55;
  const firmware = schema.items.find((item) => item.address === 6);
  const hardware = schema.items.find((item) => item.address === 70);
  if (!firmware || !hardware) throw new Error("REV07 firmware-55 derivation is incomplete");
  firmware.init = 55;
  hardware.labels = [...hardware.labels.slice(0, 6), "-", "-"];
  return schema;
}

async function readSchema(input) {
  const xml = (await readFile(input, "utf8")).replace(/<!--[\s\S]*?-->/g, "");
  const deviceMatch = xml.match(/<Device\s+([^>]+)>/);
  if (!deviceMatch) {
    throw new Error(`Device tag not found in ${input}`);
  }
  const deviceAttrs = parseAttrs(deviceMatch[1]);
  const categories = new Map();
  const items = [];

  for (const match of xml.matchAll(/<Category\s+Name="([^"]+)"\s*>([\s\S]*?)<\/Category>|<Item\s+([^>]*)\/>/g)) {
    if (match[1]) {
      const category = match[1];
      for (const itemMatch of match[2].matchAll(/<Item\s+([^>]*)\/>/g)) {
        addItem(categories, items, category, parseAttrs(itemMatch[1]));
      }
    } else if (match[3]) {
      addItem(categories, items, "Core", parseAttrs(match[3]));
    }
  }

  const sortedItems = items.sort((a, b) => a.address - b.address);
  const schema = {
    name: deviceAttrs.Name,
    modelNumber: Number(deviceAttrs.ModelNumber),
    size: Math.max(...sortedItems.map((item) => item.address + item.length)),
    categories: Array.from(categories.entries()).map(([name, categoryItems]) => ({
      name,
      items: categoryItems,
    })),
    items: sortedItems,
  };
  if (deviceAttrs.MinimumFirmwareVersion !== undefined) {
    schema.minimumFirmwareVersion = Number(deviceAttrs.MinimumFirmwareVersion);
  }
  return schema;
}

function addItem(categories, items, category, attrs) {
  const repeat = parseContinue(attrs.Continue);
  for (const index of repeat) {
    addOneItem(categories, items, category, attrs, index);
  }
}

function addOneItem(categories, items, category, attrs, continueIndex) {
  const length = Number(attrs.Length);
  const item = {
    address: Number(attrs.Address) + (continueIndex - 1) * length,
    length,
    name: formatContinuedName(attrs.Name, continueIndex),
    category,
    access: rwToAccess(attrs.RW),
    memory: attrs.Memory === "1" ? "eeprom" : "ram",
    valueType: valueType(attrs),
  };
  addOptionalNumber(item, attrs, "Min", "min");
  addOptionalNumber(item, attrs, "Max", "max");
  addOptionalNumber(item, attrs, "Init", "init");
  addOptionalNumber(item, attrs, "UI", "ui");
  if (attrs.Unit) item.unit = attrs.Unit;
  if (attrs.Scale) item.scale = Number(attrs.Scale);
  if (attrs.Label) item.labels = attrs.Label.split(":");
  if (attrs.Multi) item.multi = attrs.Multi === "1";
  items.push(item);
  if (!categories.has(category)) {
    categories.set(category, []);
  }
  categories.get(category).push(item);
}

function parseContinue(value) {
  if (!value) {
    return [1];
  }
  const match = value.match(/^(\d+)~(\d+)$/);
  if (!match) {
    throw new Error(`unsupported Continue format: ${value}`);
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
    throw new Error(`invalid Continue range: ${value}`);
  }
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

function formatContinuedName(name, index) {
  return name.includes("{0}") ? name.replaceAll("{0}", String(index)) : name;
}

function addOptionalNumber(item, attrs, attrName, propName) {
  if (attrs[attrName] !== undefined && attrs[attrName] !== "") {
    const source = attrs[attrName];
    const value = Number(source);
    if (/^-?\d+$/.test(source) && !Number.isSafeInteger(value)) {
      return;
    }
    if (Number.isFinite(value)) {
      item[propName] = value;
    }
  }
}

function valueType(attrs) {
  if (attrs.Name === "CRSF Flight Mode") {
    return "ascii";
  }
  if (attrs.Sign !== undefined && attrs.Sign !== "") {
    return "int";
  }
  return Number(attrs.Min ?? 0) < 0 ? "int" : "uint";
}

function rwToAccess(value) {
  if (value === "1") return "r";
  if (value === "2") {
    throw new Error('write-only control-table items are not supported; use RW="3" or remove the item from the exported schema');
  }
  return "rw";
}

function parseAttrs(source) {
  const attrs = {};
  for (const match of source.matchAll(/([A-Za-z]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXml(match[2]);
  }
  return attrs;
}

function decodeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
