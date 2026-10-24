import {
  BootInfo,
  Instruction,
  RESERVED_BOOTLOADER,
  bootloaderResultName,
  buildPacket,
  crc32,
  parseBootInfo,
  parseBootloaderStatus,
  writeU16LE,
  writeU32LE,
} from "./protocol.js";
import { PacketSession } from "./session.js";
import { delay, isDisconnectError } from "./transport.js";
import { DynamixelClient } from "./dynamixel-client.js";
import { parseImageIdentity, type ImageIdentity } from "./image-identity.js";
import type {
  IcmImuBuildManifest,
} from "./imu-build-manifest.js";
import {
  assertIcmImuBuildManifestMatchesBoard,
  parseIcmImuBuildManifest,
} from "./imu-build-manifest.js";

export type EntryMode = "same-port" | "reopen";
export type EntryLogger = (message: string) => void;

const ENTRY_BYTE = 0x4f;
export const DEFAULT_BOOTLOADER_BAUD_RATE = 115200;
const SUPPORTED_BOOTLOADER_PROTOCOL_VERSION = 1;
const C5_ERASE_GEOMETRY_BOOTLOADER_VERSION = 2;
const LEGACY_C5_SAFE_IMAGE_SIZE = 0x20000;
const K1_HAT_C5_APP_BASE = 0x08020000;
const K1_HAT_C5_APP_MAX_SIZE = 0x00020000;
const C5_ERASE_GEOMETRY_BOARD_IDS = new Set([
  "BSS10_A01_E001_REV03",
  "BSS10_A01_E001_REV05",
  "k1_hat_c5",
]);

function assertSupportedBootloaderProtocol(info: BootInfo): void {
  if (info.protocolVersion !== SUPPORTED_BOOTLOADER_PROTOCOL_VERSION) {
    throw new Error(
      `refusing unsupported bootloader wire protocol v${info.protocolVersion}; ` +
      `updater supports only protocol v${SUPPORTED_BOOTLOADER_PROTOCOL_VERSION}; ` +
      "no BEGIN or erase was sent",
    );
  }
}

function assertSafeC5EraseGeometry(info: BootInfo, imageSize: number): void {
  if (
    C5_ERASE_GEOMETRY_BOARD_IDS.has(info.boardId) &&
    info.bootloaderVersion < C5_ERASE_GEOMETRY_BOOTLOADER_VERSION &&
    imageSize > LEGACY_C5_SAFE_IMAGE_SIZE
  ) {
    throw new Error(
      `refusing unsafe flash: ${info.boardId} bootloader v${info.bootloaderVersion} ` +
      `cannot safely erase a ${imageSize}-byte image larger than 0x${LEGACY_C5_SAFE_IMAGE_SIZE.toString(16)} bytes; ` +
      "install bootloader v2 or newer using SWD before flashing this application; no BEGIN or erase was sent",
    );
  }
}

function assertBoardFlashLayout(info: BootInfo): void {
  const revisionLayout: Record<string, number> = {
    k1_hat_c5_rev06: 128 * 1024, k1_hat_h5_rev06: 384 * 1024, k1_imu_rev07: 384 * 1024,
  };
  const revisionSize = revisionLayout[info.boardId];
  if (revisionSize != null && (info.appBase !== 0x08020000 || info.appMaxSize !== revisionSize ||
      info.flashProgramUnit !== 16 || info.bootloaderVersion < 2)) {
    throw new Error("refusing incompatible board revision flash layout; no BEGIN or erase was sent");
  }
  if (
    info.boardId === "k1_hat_c5" &&
    (info.appBase !== K1_HAT_C5_APP_BASE ||
      info.appMaxSize !== K1_HAT_C5_APP_MAX_SIZE)
  ) {
    throw new Error(
      `refusing incompatible K1 C5 flash layout: bootloader advertises ` +
      `app base 0x${info.appBase.toString(16)}, size 0x${info.appMaxSize.toString(16)}; ` +
      `this updater requires base 0x${K1_HAT_C5_APP_BASE.toString(16)}, ` +
      `size 0x${K1_HAT_C5_APP_MAX_SIZE.toString(16)}. Install the current ` +
      "K1 C5 bootloader using ST-LINK before flashing this application; " +
      "no BEGIN or erase was sent",
    );
  }
}

function assertImageMatchesBootloader(identity: ImageIdentity, info: BootInfo): void {
  // Application identity retains the PCB target; bootloader identity is shared.
  const hatImages: Record<string, {bootloader: string; model: number; size: number}> = {
    k1_hat_c5_rev06: {bootloader: "k1_hat_c5", model: 5105, size: 128 * 1024},
    k1_hat_h5_rev06: {bootloader: "e2d2", model: 6050, size: 384 * 1024},
  };
  const target = hatImages[identity.boardId];
  const boardMatches = identity.boardId === info.boardId || target?.bootloader === info.boardId;
  if (!boardMatches || identity.appBase !== info.appBase || identity.appMaxSize !== info.appMaxSize) {
    throw new Error("application identity does not match bootloader; no BEGIN or erase was sent");
  }
  if (target && (identity.modelNumber !== target.model || identity.appBase !== 0x08020000 ||
      identity.appMaxSize !== target.size || info.flashProgramUnit !== 16 || info.bootloaderVersion < 2)) {
    throw new Error("refusing incompatible HAT application identity or flash layout; no BEGIN or erase was sent");
  }
}

function assertIcmImuManifestFlashPolicy(
  manifest: IcmImuBuildManifest,
): void {
  if (manifest.usesStm32c5CordicHil) {
    throw new Error(
      "refusing ICM STM32C5 CORDIC HIL-only firmware; " +
        "the ordinary SDK updater accepts application images, not the " +
        "nonproduction SWD HIL image; no BEGIN or erase was sent",
    );
  }
  if (manifest.isAnalysisOnlyNotFlashable) {
    throw new Error(
      "refusing ICM analysis-only/non-flashable firmware; " +
        "select a deployable characterization artifact; " +
        "no BEGIN or erase was sent",
    );
  }
  const hasProductionEstimator =
    manifest.outputRateHz > 0 || manifest.usesFixedDefaultVqf1khz;
  if (hasProductionEstimator && !manifest.usesStm32c5CordicMath) {
    throw new Error(
      "refusing ICM production-estimator firmware without STM32C5 CORDIC " +
        "math; select a canonical CORDIC-enabled image; " +
        "no BEGIN or erase was sent",
    );
  }
}

export class BootloaderClient {
  constructor(readonly session: PacketSession, readonly dxl: DynamixelClient) {}

  async enterRaw(timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const echo = this.session.waitForByte(ENTRY_BYTE, 5);
      try {
        await this.session.write(Uint8Array.from([ENTRY_BYTE]));
      } catch (err) {
        if (!isDisconnectError(err)) {
          throw err;
        }
      }
      if (await echo) {
        return;
      }
      await delay(2);
    }
    throw new Error("bootloader entry timeout");
  }

  async enterViaDxlInstruction(
    timeoutMs = 5000,
    mode: EntryMode = "same-port",
    onPhase?: EntryLogger,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    onPhase?.("Sending normal DXL PING");
    const ping = await this.dxl.ping(Math.min(1000, timeoutMs));
    onPhase?.(`Ping OK: id ${ping.id}, model ${ping.modelNumber}, firmware ${ping.firmwareVersion}`);
    onPhase?.("Sending DXL bootloader-entry instruction 0xA0");
    await this.dxl.bootloaderEntry(Math.min(1000, timeoutMs));

    if (mode === "reopen") {
      this.session.transport.setBaudRate?.(DEFAULT_BOOTLOADER_BAUD_RATE);
      onPhase?.(`Reopening at bootloader baud ${DEFAULT_BOOTLOADER_BAUD_RATE}`);
      await this.session.close().catch(() => undefined);
      while (Date.now() < deadline) {
        try {
          await this.session.open();
          await this.session.flush();
          await this.info();
          onPhase?.("Bootloader detected");
          return;
        } catch (err) {
          if (!isDisconnectError(err) && !(err instanceof Error && /timeout|not a bootloader/i.test(err.message))) {
            throw err;
          }
          await delay(100);
        }
      }
      throw new Error("bootloader entry reconnect timeout");
    }

    while (Date.now() < deadline) {
      try {
        await delay(100);
        await this.session.flush();
        await this.info();
        onPhase?.("Bootloader detected");
        return;
      } catch (err) {
        if (!(err instanceof Error && /timeout|not a bootloader/i.test(err.message))) {
          throw err;
        }
      }
    }
    throw new Error("bootloader entry same-port timeout");
  }

  async enterAuto(
    timeoutMs = 5000,
    rebootFallback = false,
    mode: EntryMode = "same-port",
    onPhase?: EntryLogger,
  ): Promise<void> {
    try {
      await this.enterViaDxlInstruction(timeoutMs, mode, onPhase);
      return;
    } catch (entryErr) {
      onPhase?.(`Ping-first entry failed: ${entryErr instanceof Error ? entryErr.message : String(entryErr)}`);
    }

    try {
      onPhase?.("Checking whether bootloader is already active");
      await this.info();
      onPhase?.("Bootloader already active");
      return;
    } catch {
      /* Continue to recovery entry paths. */
    }

    if (rebootFallback) {
      onPhase?.("Sending normal DXL reboot fallback");
      await this.dxl.reboot(1000).catch((err) => {
        if (!isDisconnectError(err)) {
          throw err;
        }
      });
      await delay(250);
    }

    onPhase?.("Using raw O bootloader-entry fallback");
    await this.enterRaw(timeoutMs);
    onPhase?.("Bootloader raw entry confirmed");
  }

  async info(timeoutMs = 1000): Promise<BootInfo> {
    return parseBootInfo(await this.command(Instruction.Info, new Uint8Array(), timeoutMs));
  }

  async begin(size: number, imageCrc32: number, version = 0): Promise<void> {
    const params = new Uint8Array(12);
    writeU32LE(params, 0, size);
    writeU32LE(params, 4, imageCrc32);
    writeU32LE(params, 8, version);
    await this.command(Instruction.Begin, params, 20000);
  }

  async writeChunk(offset: number, chunk: Uint8Array): Promise<void> {
    const params = new Uint8Array(10 + chunk.length);
    writeU32LE(params, 0, offset);
    writeU16LE(params, 4, chunk.length);
    writeU32LE(params, 6, crc32(chunk));
    params.set(chunk, 10);
    await this.command(Instruction.Write, params, 3000);
  }

  async verify(): Promise<void> {
    await this.command(Instruction.Verify, new Uint8Array(), 10000);
  }

  async commit(): Promise<void> {
    await this.command(Instruction.Commit, new Uint8Array(), 3000);
  }

  async runApp(): Promise<void> {
    await this.command(Instruction.RunApp, new Uint8Array(), 3000);
  }

  async flash(image: Uint8Array, onProgress?: (done: number, total: number) => void, version = 0, expectedBoardId?: string): Promise<BootInfo> {
    const info = await this.info();
    if (expectedBoardId != null && info.boardId !== expectedBoardId) {
      throw new Error(`unexpected bootloader board ID ${info.boardId}; expected ${expectedBoardId}; no BEGIN or erase was sent`);
    }
    assertSupportedBootloaderProtocol(info);
    assertBoardFlashLayout(info);
    assertSafeC5EraseGeometry(info, image.length);
    if (image.length > info.appMaxSize) {
      throw new Error(`image too large: ${image.length} > ${info.appMaxSize}`);
    }
    const imuManifest = parseIcmImuBuildManifest(image);
    const identity = parseImageIdentity(image);
    if (identity) assertImageMatchesBootloader(identity, info);
    if ((info.boardId === "k1_hat_c5_rev06" || info.boardId === "k1_hat_h5_rev06") && !identity) {
      throw new Error("revision application identity is missing; no BEGIN or erase was sent");
    }
    if (info.boardId === "k1_imu_rev07" && !imuManifest) {
      throw new Error("REV07 IMU manifest is missing; no BEGIN or erase was sent");
    }
    if (imuManifest) {
      assertIcmImuBuildManifestMatchesBoard(imuManifest, info.boardId);
      assertIcmImuManifestFlashPolicy(imuManifest);
    }
    const chunkSize = Math.min(info.preferredChunkSize || 1024, 1024);
    await this.begin(image.length, crc32(image), version);
    for (let offset = 0; offset < image.length; offset += chunkSize) {
      const chunk = image.subarray(offset, Math.min(offset + chunkSize, image.length));
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.writeChunk(offset, chunk);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          await delay(50);
        }
      }
      if (lastError) {
        throw lastError;
      }
      onProgress?.(Math.min(offset + chunk.length, image.length), image.length);
    }
    await this.verify();
    await this.commit();
    return info;
  }

  private async command(instruction: number, params = new Uint8Array(), timeoutMs = 1000): Promise<Uint8Array> {
    await this.session.write(buildPacket(this.dxl.getId(), instruction, params, RESERVED_BOOTLOADER, { byteStuff: false }));
    const status = parseBootloaderStatus(await this.session.waitForPacket(timeoutMs));
    if (status.result !== 0) {
      throw new Error(`bootloader command 0x${instruction.toString(16)} failed: ${bootloaderResultName(status.result)}`);
    }
    return status.data;
  }
}
