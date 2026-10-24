import assert from "node:assert/strict";

import { BootloaderClient } from "./bootloader-client.js";
import { DynamixelClient } from "./dynamixel-client.js";
import {
  Instruction,
  RESERVED_BOOTLOADER,
  RESERVED_DXL,
  buildPacket,
  parsePacket,
  writeU16LE,
  writeU32LE,
} from "./protocol.js";
import type { PacketSession } from "./session.js";
import { parseImageIdentity } from "./image-identity.js";

class FakeSession {
  readonly transport = {};
  packets: Uint8Array[] = [];
  writes: Uint8Array[] = [];
  flushCount = 0;

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
  }

  async waitForPacket(): Promise<Uint8Array> {
    const packet = this.packets.shift();
    if (!packet) {
      throw new Error("no queued packet");
    }
    return packet;
  }

  async flush(): Promise<void> {
    this.flushCount++;
  }
}

class FakeDxl {
  calls: Array<string | [string, number, number]> = [];

  constructor(private readonly modelNumber: number) {}

  getId(): number {
    return 1;
  }

  async ping(): Promise<{ id: number; modelNumber: number; firmwareVersion: number }> {
    this.calls.push("ping");
    return { id: 1, modelNumber: this.modelNumber, firmwareVersion: 12 };
  }

  async bootloaderEntry(): Promise<void> {
    this.calls.push("bootloaderEntry");
  }
}

function bootInfoStatus(
  boardIdValue = "k1_hat_c5",
  options: {
    protocolVersion?: number;
    bootloaderVersion?: number;
    appBase?: number;
    appMaxSize?: number;
    flashProgramUnit?: number;
  } = {},
): Uint8Array {
  const boardId = new TextEncoder().encode(boardIdValue);
  const data = new Uint8Array(25 + boardId.length);
  let offset = 0;
  data[offset] = options.protocolVersion ?? 1; offset += 1;
  writeU16LE(data, offset, options.bootloaderVersion ?? 1); offset += 2;
  writeU32LE(data, offset, options.appBase ?? 0x08010000); offset += 4;
  writeU32LE(data, offset, options.appMaxSize ?? 160 * 1024); offset += 4;
  writeU16LE(data, offset, options.flashProgramUnit ?? 16); offset += 2;
  writeU16LE(data, offset, 1024); offset += 2;
  data[offset] = 1; offset += 1;
  writeU32LE(data, offset, 4096); offset += 4;
  writeU32LE(data, offset, 0x12345678); offset += 4;
  data[offset] = boardId.length; offset += 1;
  data.set(boardId, offset);

  const params = new Uint8Array(1 + data.length);
  params[0] = 0;
  params.set(data, 1);
  return buildPacket(1, Instruction.Status, params, RESERVED_BOOTLOADER, { byteStuff: false });
}

const c5InfoGoldenSession = new FakeSession();
c5InfoGoldenSession.packets.push(
  bootInfoStatus("BSS10_A01_E001_REV05", {
    bootloaderVersion: 2,
  }),
);
const c5InfoGolden = await new BootloaderClient(
  c5InfoGoldenSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
).info();
assert.deepEqual(c5InfoGolden, {
  protocolVersion: 1,
  bootloaderVersion: 2,
  appBase: 0x08010000,
  appMaxSize: 160 * 1024,
  flashProgramUnit: 16,
  preferredChunkSize: 1024,
  appValid: true,
  appSize: 4096,
  appCrc32: 0x12345678,
  boardId: "BSS10_A01_E001_REV05",
});

const k1Session = new FakeSession();
k1Session.packets.push(bootInfoStatus());
const k1Dxl = new FakeDxl(5105);
await new BootloaderClient(
  k1Session as unknown as PacketSession,
  k1Dxl as unknown as DynamixelClient,
).enterViaDxlInstruction(1000);
assert.deepEqual(k1Dxl.calls, [
  "ping",
  "bootloaderEntry",
]);
assert.equal(k1Session.flushCount, 1);

const otherSession = new FakeSession();
otherSession.packets.push(bootInfoStatus());
const otherDxl = new FakeDxl(65500);
await new BootloaderClient(
  otherSession as unknown as PacketSession,
  otherDxl as unknown as DynamixelClient,
).enterViaDxlInstruction(1000);
assert.deepEqual(otherDxl.calls, [
  "ping",
  "bootloaderEntry",
]);

function dxlStatus(data = new Uint8Array()): Uint8Array {
  const params = new Uint8Array(1 + data.length);
  params.set(data, 1);
  return buildPacket(
    1,
    Instruction.Status,
    params,
    RESERVED_DXL,
  );
}

class StatefulReopenSession {
  readonly events: string[] = [];
  readonly packets: Uint8Array[] = [];
  readonly transport = {
    setBaudRate: (baudRate: number): void => {
      this.baudRate = baudRate;
      this.events.push(`baud:${baudRate}`);
    },
  };
  private baudRate = 6000000;

  async write(data: Uint8Array): Promise<void> {
    if (data.length === 1) {
      this.events.push(`raw:${data[0]}@${this.baudRate}`);
      return;
    }
    const packet = parsePacket(data);
    this.events.push(
      `packet:${packet.reserved}:${packet.instruction}@${this.baudRate}`,
    );
  }

  async waitForPacket(): Promise<Uint8Array> {
    const packet = this.packets.shift();
    if (!packet) {
      throw new Error("no queued packet");
    }
    return packet;
  }

  async waitForByte(expected: number): Promise<boolean> {
    this.events.push(`raw-wait:${expected}@${this.baudRate}`);
    return false;
  }

  async flush(): Promise<void> {
    this.events.push(`flush@${this.baudRate}`);
  }

  async close(): Promise<void> {
    this.events.push("close");
  }

  async open(): Promise<void> {
    this.events.push(`open@${this.baudRate}`);
  }
}

const pingData = new Uint8Array(3);
writeU16LE(pingData, 0, 42688);
pingData[2] = 47;
const reopenSession = new StatefulReopenSession();
reopenSession.packets.push(
  dxlStatus(pingData),
  dxlStatus(),
  bootInfoStatus("BSS10_A01_E001_REV05"),
);
const reopenDxl = new DynamixelClient(
  reopenSession as unknown as PacketSession,
  1,
);
await new BootloaderClient(
  reopenSession as unknown as PacketSession,
  reopenDxl,
).enterViaDxlInstruction(1000, "reopen");
assert.deepEqual(reopenSession.events, [
  "flush@6000000",
  `packet:${RESERVED_DXL}:${Instruction.DxlPing}@6000000`,
  "flush@6000000",
  `packet:${RESERVED_DXL}:${Instruction.DxlBootloaderEntry}@6000000`,
  "baud:115200",
  "close",
  "open@115200",
  "flush@115200",
  `packet:${RESERVED_BOOTLOADER}:${Instruction.Info}@115200`,
]);
assert.equal(
  reopenSession.events.some((event) => event.startsWith("raw:")),
  false,
);
assert.equal(
  reopenSession.events.some((event) =>
    event.includes(`:${Instruction.DxlReboot}@`)),
  false,
);

const noRawOnInfoFailureSession = new StatefulReopenSession();
noRawOnInfoFailureSession.packets.push(
  dxlStatus(pingData),
  dxlStatus(),
);
const noRawOnInfoFailureDxl = new DynamixelClient(
  noRawOnInfoFailureSession as unknown as PacketSession,
  1,
);
await assert.rejects(
  new BootloaderClient(
    noRawOnInfoFailureSession as unknown as PacketSession,
    noRawOnInfoFailureDxl,
  ).enterViaDxlInstruction(1000, "reopen"),
  /no queued packet/,
);
assert.equal(
  noRawOnInfoFailureSession.events.some((event) =>
    event.startsWith("raw:") || event.startsWith("raw-wait:")),
  false,
);
assert.equal(
  noRawOnInfoFailureSession.events.some((event) =>
    event.includes(`:${Instruction.DxlReboot}@`)),
  false,
);

const ANALYSIS_ONLY_NOT_FLASHABLE_FLAG = 1 << 5;
const DEPLOYABLE_CHARACTERIZATION_FLAG = 1 << 6;
const VQF_FIXED_DEFAULT_1KHZ_FLAG = 1 << 7;
const LAB_ONLY_FLAG = 1 << 2;
const STM32C5_CORDIC_MATH_FLAG = 1 << 13;
const STM32C5_CORDIC_HIL_FLAG = 1 << 14;

function rev05IcmImage(
  schemaVersion = 5,
  flags =
    DEPLOYABLE_CHARACTERIZATION_FLAG |
    VQF_FIXED_DEFAULT_1KHZ_FLAG |
    STM32C5_CORDIC_MATH_FLAG,
  outputRateHz = 1000,
): Uint8Array {
  const image = new Uint8Array(512);
  const offset = 16;
  writeU32LE(image, offset, 0x494d554d);
  writeU16LE(image, offset + 4, schemaVersion);
  writeU16LE(image, offset + 6, 432);
  writeU16LE(image, offset + 10, 5);
  writeU16LE(image, offset + 12, flags);
  image[offset + 14] = 2;
  writeU32LE(image, offset + 16, 1000);
  writeU32LE(image, offset + 20, outputRateHz);
  writeU32LE(image, offset + 44, 0x00020005);
  image.set(new TextEncoder().encode("BSS10_A01_E001_REV05"), offset + 88);
  image.set(new TextEncoder().encode("REV05_ICM42688_TO_FLU_V2"), offset + 112);
  image.set(new TextEncoder().encode("DEFERRED_HW_SIX_FACE"), offset + 144);
  image.set(
    new Uint8Array([0, 0, 0xff, 0xff, 0, 0, 0, 1, 0]),
    offset + 420,
  );
  return image;
}

const mismatchSession = new FakeSession();
mismatchSession.packets.push(bootInfoStatus("BSS10_A01_E001_REV03"));
const mismatchClient = new BootloaderClient(
  mismatchSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  mismatchClient.flash(rev05IcmImage()),
  /board profile mismatch; no flash erase or image write was attempted/,
);
assert.equal(mismatchSession.writes.length, 1);
assert.deepEqual(
  mismatchSession.writes[0],
  buildPacket(1, Instruction.Info, new Uint8Array(), RESERVED_BOOTLOADER, { byteStuff: false }),
);

const wrongTransformImage = rev05IcmImage();
writeU32LE(wrongTransformImage, 16 + 44, 0x00010005);
const wrongTransformSession = new FakeSession();
wrongTransformSession.packets.push(bootInfoStatus("BSS10_A01_E001_REV05"));
const wrongTransformClient = new BootloaderClient(
  wrongTransformSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  wrongTransformClient.flash(wrongTransformImage),
  /board profile 5 requires sensor-to-body transform 0x00020005/,
);
assert.equal(wrongTransformSession.writes.length, 1);
assert.deepEqual(
  wrongTransformSession.writes[0],
  buildPacket(1, Instruction.Info, new Uint8Array(), RESERVED_BOOTLOADER, { byteStuff: false }),
);

const wrongMatrixImage = rev05IcmImage();
wrongMatrixImage[16 + 420 + 3] = 0;
const wrongMatrixSession = new FakeSession();
wrongMatrixSession.packets.push(bootInfoStatus("BSS10_A01_E001_REV05"));
const wrongMatrixClient = new BootloaderClient(
  wrongMatrixSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  wrongMatrixClient.flash(wrongMatrixImage),
  /board profile 5 requires sensor-to-body matrix/,
);
assert.equal(wrongMatrixSession.writes.length, 1);
assert.deepEqual(
  wrongMatrixSession.writes[0],
  buildPacket(1, Instruction.Info, new Uint8Array(), RESERVED_BOOTLOADER, { byteStuff: false }),
);

const unsupportedSchemaSession = new FakeSession();
unsupportedSchemaSession.packets.push(bootInfoStatus("BSS10_A01_E001_REV05"));
const unsupportedSchemaClient = new BootloaderClient(
  unsupportedSchemaSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  unsupportedSchemaClient.flash(rev05IcmImage(4)),
  /unsupported ICM build manifest schema 4; updater supports schema 5/,
);
assert.equal(unsupportedSchemaSession.writes.length, 1);
assert.deepEqual(
  unsupportedSchemaSession.writes[0],
  buildPacket(1, Instruction.Info, new Uint8Array(), RESERVED_BOOTLOADER, { byteStuff: false }),
);

const analysisOnlySession = new FakeSession();
analysisOnlySession.packets.push(bootInfoStatus("BSS10_A01_E001_REV05"));
const analysisOnlyClient = new BootloaderClient(
  analysisOnlySession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  analysisOnlyClient.flash(
    rev05IcmImage(
      5,
      ANALYSIS_ONLY_NOT_FLASHABLE_FLAG |
        VQF_FIXED_DEFAULT_1KHZ_FLAG,
    ),
  ),
  /refusing ICM analysis-only\/non-flashable firmware.*no BEGIN or erase was sent/,
);
assert.equal(analysisOnlySession.writes.length, 1);
assert.equal(
  parsePacket(analysisOnlySession.writes[0]).instruction,
  Instruction.Info,
);

const cordicHilSession = new FakeSession();
cordicHilSession.packets.push(
  bootInfoStatus("BSS10_A01_E001_REV05"),
);
const cordicHilClient = new BootloaderClient(
  cordicHilSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  cordicHilClient.flash(
    rev05IcmImage(
      5,
      LAB_ONLY_FLAG |
        ANALYSIS_ONLY_NOT_FLASHABLE_FLAG |
        VQF_FIXED_DEFAULT_1KHZ_FLAG |
        STM32C5_CORDIC_MATH_FLAG |
        STM32C5_CORDIC_HIL_FLAG,
    ),
  ),
  /refusing ICM STM32C5 CORDIC HIL-only firmware.*no BEGIN or erase was sent/,
);
assert.equal(cordicHilSession.writes.length, 1);
assert.equal(
  parsePacket(cordicHilSession.writes[0]).instruction,
  Instruction.Info,
);

const mislabeledCordicHilSession = new FakeSession();
mislabeledCordicHilSession.packets.push(
  bootInfoStatus("BSS10_A01_E001_REV05"),
);
const mislabeledCordicHilClient = new BootloaderClient(
  mislabeledCordicHilSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  mislabeledCordicHilClient.flash(
    rev05IcmImage(
      5,
      LAB_ONLY_FLAG |
        DEPLOYABLE_CHARACTERIZATION_FLAG |
        VQF_FIXED_DEFAULT_1KHZ_FLAG |
        STM32C5_CORDIC_MATH_FLAG |
        STM32C5_CORDIC_HIL_FLAG,
    ),
  ),
  /CORDIC HIL requires.*forbids DEPLOYABLE_CHARACTERIZATION/,
);
assert.equal(mislabeledCordicHilSession.writes.length, 1);
assert.equal(
  parsePacket(mislabeledCordicHilSession.writes[0]).instruction,
  Instruction.Info,
);

const mislabeledCordic0Session = new FakeSession();
mislabeledCordic0Session.packets.push(
  bootInfoStatus("BSS10_A01_E001_REV05"),
);
const mislabeledCordic0Client = new BootloaderClient(
  mislabeledCordic0Session as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  mislabeledCordic0Client.flash(
    rev05IcmImage(
      5,
      DEPLOYABLE_CHARACTERIZATION_FLAG |
        VQF_FIXED_DEFAULT_1KHZ_FLAG,
    ),
  ),
  /refusing ICM production-estimator firmware without STM32C5 CORDIC math.*no BEGIN or erase was sent/,
);
assert.equal(mislabeledCordic0Session.writes.length, 1);
assert.equal(
  parsePacket(mislabeledCordic0Session.writes[0]).instruction,
  Instruction.Info,
);

const rawImudbgCordic0Session = new FakeSession();
rawImudbgCordic0Session.packets.push(
  bootInfoStatus("BSS10_A01_E001_REV05"),
);
const rawImudbgCordic0Client = new BootloaderClient(
  rawImudbgCordic0Session as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  rawImudbgCordic0Client.flash(
    rev05IcmImage(5, DEPLOYABLE_CHARACTERIZATION_FLAG, 0),
  ),
  /no queued packet/,
);
assert.equal(rawImudbgCordic0Session.writes.length, 2);
assert.equal(
  parsePacket(rawImudbgCordic0Session.writes[0]).instruction,
  Instruction.Info,
);
assert.equal(
  parsePacket(rawImudbgCordic0Session.writes[1]).instruction,
  Instruction.Begin,
);

const unsupportedProtocolSession = new FakeSession();
unsupportedProtocolSession.packets.push(
  bootInfoStatus("BSS10_A01_E001_REV05", {
    protocolVersion: 2,
    bootloaderVersion: 2,
    appMaxSize: 160 * 1024,
  }),
);
const unsupportedProtocolClient = new BootloaderClient(
  unsupportedProtocolSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  unsupportedProtocolClient.flash(new Uint8Array(1)),
  /refusing unsupported bootloader wire protocol v2.*supports only protocol v1.*no BEGIN or erase was sent/,
);
assert.equal(unsupportedProtocolSession.writes.length, 1);
assert.equal(
  parsePacket(unsupportedProtocolSession.writes[0]).instruction,
  Instruction.Info,
);

for (const boardId of [
  "BSS10_A01_E001_REV03",
  "BSS10_A01_E001_REV05",
]) {
  const legacyC5Session = new FakeSession();
  legacyC5Session.packets.push(bootInfoStatus(boardId, {
    bootloaderVersion: 1,
    appMaxSize: 160 * 1024,
  }));
  const legacyC5Client = new BootloaderClient(
    legacyC5Session as unknown as PacketSession,
    new FakeDxl(5105) as unknown as DynamixelClient,
  );
  await assert.rejects(
    legacyC5Client.flash(new Uint8Array(0x20001)),
    new RegExp(
      `refusing unsafe flash: ${boardId} bootloader v1.*` +
      "install bootloader v2 or newer using SWD.*no BEGIN or erase was sent",
    ),
  );
  assert.equal(legacyC5Session.writes.length, 1);
  assert.equal(parsePacket(legacyC5Session.writes[0]).instruction, Instruction.Info);
}

const legacyK1LayoutSession = new FakeSession();
legacyK1LayoutSession.packets.push(bootInfoStatus("k1_hat_c5", {
  bootloaderVersion: 2,
  appBase: 0x08010000,
  appMaxSize: 160 * 1024,
}));
const legacyK1LayoutClient = new BootloaderClient(
  legacyK1LayoutSession as unknown as PacketSession,
  new FakeDxl(5105) as unknown as DynamixelClient,
);
await assert.rejects(
  legacyK1LayoutClient.flash(new Uint8Array(4096)),
  /refusing incompatible K1 C5 flash layout: bootloader advertises app base 0x8010000.*requires base 0x8020000.*ST-LINK.*no BEGIN or erase was sent/,
);
assert.equal(legacyK1LayoutSession.writes.length, 1);
assert.equal(
  parsePacket(legacyK1LayoutSession.writes[0]).instruction,
  Instruction.Info,
);

for (const {
  boardId,
  bootloaderVersion,
  imageSize,
} of [
  {
    boardId: "BSS10_A01_E001_REV05",
    bootloaderVersion: 1,
    imageSize: 0x20000,
  },
  {
    boardId: "BSS10_A01_E001_REV05",
    bootloaderVersion: 2,
    imageSize: 0x20001,
  },
  {
    boardId: "k1_hat_c5",
    bootloaderVersion: 2,
    imageSize: 0x20000,
  },
  {
    boardId: "other_board",
    bootloaderVersion: 1,
    imageSize: 0x20001,
  },
]) {
  const allowedSession = new FakeSession();
  allowedSession.packets.push(bootInfoStatus(boardId, {
    bootloaderVersion,
    appBase: boardId === "k1_hat_c5" ? 0x08020000 : 0x08010000,
    appMaxSize: boardId === "k1_hat_c5" ? 128 * 1024 : 160 * 1024,
  }));
  const allowedClient = new BootloaderClient(
    allowedSession as unknown as PacketSession,
    new FakeDxl(5105) as unknown as DynamixelClient,
  );
  await assert.rejects(
    allowedClient.flash(new Uint8Array(imageSize)),
    /no queued packet/,
  );
  assert.equal(allowedSession.writes.length, 2);
  assert.equal(parsePacket(allowedSession.writes[0]).instruction, Instruction.Info);
  assert.equal(parsePacket(allowedSession.writes[1]).instruction, Instruction.Begin);
}

function revisionImage(boardId: string): Uint8Array {
  const image = new Uint8Array(128);
  const view = new DataView(image.buffer);
  view.setUint32(32, 0x43594249, true);
  view.setUint16(36, 1, true); view.setUint16(38, 64, true);
  view.setUint32(40, 0x08020000, true);
  view.setUint32(44, (boardId === "k1_hat_h5_rev06" ? 384 : 128) * 1024, true);
  view.setUint16(48, 35, true); view.setUint16(50, boardId === "k1_hat_h5_rev06" ? 6050 : 5105, true);
  image.set(new TextEncoder().encode(boardId), 52);
  return image;
}
assert.equal(parseImageIdentity(revisionImage("k1_hat_c5_rev06"))?.firmwareVersion, 35);
for (const incompatible of [{flashProgramUnit: 8}, {bootloaderVersion: 1},
  {appBase: 0x08010000}, {appMaxSize: 160 * 1024}]) {
  const session = new FakeSession();
  session.packets.push(bootInfoStatus("k1_hat_c5_rev06", {bootloaderVersion: 2,
    appBase: 0x08020000, appMaxSize: 128 * 1024, ...incompatible}));
  const client = new BootloaderClient(session as unknown as PacketSession,
    new FakeDxl(5105) as unknown as DynamixelClient);
  await assert.rejects(client.flash(revisionImage("k1_hat_c5_rev06")), /flash layout/);
  assert.equal(session.writes.length, 1, "bad geometry must not erase");
}
for (const [boardId, image, expected] of [
  ["k1_hat_c5_rev06", revisionImage("k1_hat_h5_rev06"), undefined],
  ["k1_hat_c5_rev06", new Uint8Array(128), undefined],
  ["k1_hat_c5", revisionImage("k1_hat_h5_rev06"), undefined],
  ["e2d2", revisionImage("k1_hat_c5_rev06"), undefined],
  ["k1_hat_c5_rev06", revisionImage("k1_hat_c5_rev06"), "k1_hat_h5_rev06"],
  ["k1_imu_rev07", new Uint8Array(128), undefined],
] as const) {
  const session = new FakeSession();
  session.packets.push(bootInfoStatus(boardId, {bootloaderVersion:2, appBase:0x08020000,
    appMaxSize:boardId === "k1_imu_rev07" ? 384*1024 : 128*1024}));
  const client = new BootloaderClient(session as unknown as PacketSession,
    new FakeDxl(5105) as unknown as DynamixelClient);
  await assert.rejects(client.flash(image, undefined, 0, expected));
  assert.equal(session.writes.length, 1, "identity rejection must precede BEGIN/erase");
}

for (const [boardId, imageId, appMaxSize] of [
  ["k1_hat_c5", "k1_hat_c5_rev06", 128 * 1024],
  ["e2d2", "k1_hat_h5_rev06", 384 * 1024],
] as const) {
  const makeClient = (image: Uint8Array, options = {}) => {
    const session = new FakeSession();
    session.packets.push(bootInfoStatus(boardId, {
      bootloaderVersion: 2, appBase: 0x08020000, appMaxSize, ...options,
    }));
    return {session, image, client: new BootloaderClient(session as unknown as PacketSession,
      new FakeDxl(boardId === "e2d2" ? 6050 : 5105) as unknown as DynamixelClient)};
  };
  const valid = makeClient(revisionImage(imageId));
  for (let i = 0; i < 4; i++) {
    valid.session.packets.push(buildPacket(1, Instruction.Status, new Uint8Array([0]),
      RESERVED_BOOTLOADER, {byteStuff: false}));
  }
  const info = await valid.client.flash(valid.image, undefined, 0, boardId);
  assert.equal(info.boardId, boardId);
  assert.deepEqual(valid.session.writes.map(packet => parsePacket(packet).instruction),
    [Instruction.Info, Instruction.Begin, Instruction.Write, Instruction.Verify, Instruction.Commit]);

  for (const options of [{flashProgramUnit: 8}, {bootloaderVersion: 1},
    {appBase: 0x08010000}, {appMaxSize: appMaxSize + 8192}]) {
    const invalid = makeClient(revisionImage(imageId), options);
    await assert.rejects(invalid.client.flash(invalid.image, undefined, 0, boardId), /flash layout|identity/);
    assert.equal(invalid.session.writes.length, 1, "shared ID must not weaken geometry checks");
  }
  const badModelImage = revisionImage(imageId);
  new DataView(badModelImage.buffer).setUint16(50, 42689, true);
  const badModel = makeClient(badModelImage);
  await assert.rejects(badModel.client.flash(badModel.image), /identity/);
  assert.equal(badModel.session.writes.length, 1, "model mismatch must not erase");
}
console.log("bootloader client tests ok");
