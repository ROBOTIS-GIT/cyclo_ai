import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkOnly = process.argv.includes("--check");

const models = [
  {
    input: resolve(root, "projects/k1_hat_rev06/board.xml"),
    output: resolve(root, "projects/k1_hat_rev06/board.model"),
    skipCategories: ["Indirect Address Write", "Indirect Address Read", "Indirect Data Write", "Indirect Data Read"],
    anchors: [[512, 2, "Indirect Address Write"], [1152, 1, "Indirect Data Write"],
      [640, 2, "Indirect Address Read"], [1216, 1, "Indirect Data Read"]],
  },
  {
    input: resolve(root, "projects/k1_hat_h5_rev06/E2D2_H5.xml"),
    output: resolve(root, "projects/k1_hat_h5_rev06/E2D2_H5.model"),
  },
  {
    input: resolve(root, "projects/k1_imu_rev07/K1_IMU_REV07.xml"),
    output: resolve(root, "projects/k1_imu_rev07/k1_imu_rev07.model"),
    aliases: {
      "angular_velocity.x": "Angular Velocity X",
      "angular_velocity.y": "Angular Velocity Y",
      "angular_velocity.z": "Angular Velocity Z",
      "linear_acceleration.x": "Specific Force X",
      "linear_acceleration.y": "Specific Force Y",
      "linear_acceleration.z": "Specific Force Z",
      "orientation.w": "Orientation W",
      "orientation.x": "Orientation X",
      "orientation.y": "Orientation Y",
      "orientation.z": "Orientation Z",
    },
    skipCategories: ["Indirect Address", "Indirect Data"],
    anchors: [[384, 2, "Indirect Address 1"], [512, 1, "Indirect Data 1"],
      [384, 2, "Indirect Address Read"], [512, 1, "Indirect Data Read"]],
  },
  {
    input: resolve(root, "projects/k1_hat/board.xml"),
    output: resolve(root, "projects/k1_hat/board.model"),
    skipCategories: ["Indirect Address Write", "Indirect Address Read", "Indirect Data Write", "Indirect Data Read"],
    anchors: [
      [512, 2, "Indirect Address Write"],
      [1152, 1, "Indirect Data Write"],
      [640, 2, "Indirect Address Read"],
      [1216, 1, "Indirect Data Read"],
    ],
  },
  {
    input: resolve(root, "projects/k1_hat_h5/E2D2_H5.xml"),
    output: resolve(root, "projects/k1_hat_h5/E2D2_H5.model"),
  },
  {
    input: resolve(root, "projects/icm42688_c5_imu/ICM42688_C5_IMU.xml"),
    output: resolve(root, "projects/icm42688_c5_imu/icm42688_c5_imu.model"),
    skipCategories: ["Indirect Address", "Indirect Data"],
    anchors: [
      [384, 2, "Indirect Address 1"],
      [512, 1, "Indirect Data 1"],
      [384, 2, "Indirect Address Read"],
      [512, 1, "Indirect Data Read"],
    ],
  },
  {
    input: resolve(root, "projects/opencr_neopixel_dxl/OPENCR_NEOPIXEL_DXL.xml"),
    output: resolve(root, "projects/opencr_neopixel_dxl/opencr_neopixel_dxl.model"),
  },
  {
    input: resolve(root, "projects/openrb_elrs/OPENRB_CRSF.xml"),
    output: resolve(root, "projects/openrb_elrs/openrb_elrs.model"),
  },
  {
    input: resolve(root, "projects/openrb_usb2dxl/OPENRB_USB2DXL.xml"),
    output: resolve(root, "projects/openrb_usb2dxl/openrb_usb2dxl.model"),
  },
  {
    input: resolve(root, "projects/e2d2/E2D2_H5.xml"),
    output: resolve(root, "projects/e2d2/E2D2_H5.model"),
  },
  {
    input: resolve(root, "projects/template_stm32_dxl/board.xml"),
    output: resolve(root, "projects/template_stm32_dxl/board.model"),
  },
];

let stale = false;
for (const config of models) {
  const xml = await readFile(config.input, "utf8");
  const generated = generateModel(xml, config);
  if (checkOnly) {
    const current = await readFile(config.output, "utf8").catch(() => "");
    if (current !== generated) {
      console.error(`stale model file: ${config.output}`);
      stale = true;
    }
  } else {
    await writeFile(config.output, generated);
    console.log(`generated ${config.output}`);
  }
}

if (stale) {
  process.exitCode = 1;
}

function generateModel(xmlSource, config) {
  const xml = xmlSource.replace(/<!--[\s\S]*?-->/g, "");
  const skipCategories = new Set(config.skipCategories ?? []);
  const items = [];

  for (const match of xml.matchAll(/<Category\s+Name="([^"]+)"\s*>([\s\S]*?)<\/Category>|<Item\s+([^>]*)\/>/g)) {
    if (match[1]) {
      if (skipCategories.has(match[1])) continue;
      for (const itemMatch of match[2].matchAll(/<Item\s+([^>]*)\/>/g)) {
        addItems(items, parseAttrs(itemMatch[1]), config);
      }
    } else if (match[3]) {
      addItems(items, parseAttrs(match[3]), config);
    }
  }

  const anchors = (config.anchors ?? []).map(([address, length, name]) => ({
    address,
    length,
    name,
    scale: "1",
    unit: "1",
    sign: "unsigned",
  }));
  const aliases = Object.entries(config.aliases ?? {}).map(([name, sourceName]) => {
    const source = items.find(item => item.name === sourceName);
    if (!source) throw new Error(`model alias ${name} has no XML source ${sourceName}`);
    return { ...source, name };
  });
  const modelItems = [...items, ...anchors, ...aliases]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.address === item.address && candidate.name === item.name) === index)
    .sort((a, b) => a.address - b.address);

  const unitItems = modelItems.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.name === item.name) === index,
  );
  const unitLines = unitItems.map(
    (item) => `${item.name}\t${item.scale}\t${item.unit}\t${item.sign}\t0.0`,
  );
  const tableLines = modelItems.map(
    (item) => `${item.address}\t${item.length}\t${item.name}`,
  );

  return `[unit info]\nData Name\tvalue\tunit\tSign Type\tOffset\n${unitLines.join("\n")}\n\n[control table]\nAddress\tSize\tData Name\n${tableLines.join("\n")}\n`;
}

function addItems(items, attrs, config) {
  const length = Number(attrs.Length);
  for (const index of parseContinue(attrs.Continue)) {
    const expandedName = attrs.Name.includes("{0}") ? attrs.Name.replaceAll("{0}", String(index)) : attrs.Name;
    items.push({
      address: Number(attrs.Address) + (index - 1) * length,
      length,
      name: config.nameMap?.[expandedName] ?? expandedName,
      scale: attrs.Scale ?? "1",
      unit: attrs.Unit ?? "1",
      sign: attrs.Sign !== undefined || Number(attrs.Min ?? 0) < 0 ? "signed" : "unsigned",
    });
  }
}

function parseContinue(value) {
  if (!value) return [1];
  const match = value.match(/^(\d+)~(\d+)$/);
  if (!match) throw new Error(`unsupported Continue format: ${value}`);
  const start = Number(match[1]);
  const end = Number(match[2]);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
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
