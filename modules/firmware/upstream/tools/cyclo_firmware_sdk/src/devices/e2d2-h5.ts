import { DynamixelClient } from "../dynamixel-client.js";
import { delay } from "../transport.js";

export const E2D2_H5_MODEL_NUMBER = 6050;

const CT = {
  socketProtocolBase: 34,
  socketPortBase: 40,
  dxlBaudBase: 54,
  c5LinkAppliedBaud: 60,
  c5LinkBaudPending: 61,
} as const;

export const E2D2_DXL_BAUD_RATES = [
  9600,
  57600,
  115200,
  1000000,
  2000000,
  3000000,
  4000000,
  4500000,
  6000000,
] as const;

export interface E2D2ChannelProfile {
  channel: number;
  socketPort: number;
  socketProtocol: "tcp" | "udp";
  dxlBaudRate: number;
  dxlBaudIndex: number;
}

export interface E2D2ApplyProfileOptions {
  channels?: number[];
  baudRate?: number;
  socketProtocol?: "tcp" | "udp";
  firstSocketPort?: number;
  timeoutMs?: number;
}

export interface E2D2ApplyProfileResult {
  modelNumber?: number;
  firmwareVersion?: number;
  channels: E2D2ChannelProfile[];
}

export interface E2D2SetDxlBaudOptions {
  channels: number[];
  baudRate: number;
  timeoutMs?: number;
}

export interface E2D2ChannelBaud {
  channel: number;
  dxlBaudRate: number;
  dxlBaudIndex: number;
}

export interface E2D2ChannelSocket {
  channel: number;
  socketPort: number;
  socketProtocol: "tcp" | "udp";
}

export class E2D2H5Device {
  constructor(readonly dxl: DynamixelClient) {}

  async applyK1SixMegProfile(options: E2D2ApplyProfileOptions = {}): Promise<E2D2ApplyProfileResult> {
    return this.applyBridgeProfile({
      channels: options.channels ?? [1, 2, 3, 4, 5, 6],
      baudRate: options.baudRate ?? 6000000,
      socketProtocol: options.socketProtocol ?? "udp",
      firstSocketPort: options.firstSocketPort ?? 5001,
      timeoutMs: options.timeoutMs,
    });
  }

  async applyBridgeProfile(options: Required<Omit<E2D2ApplyProfileOptions, "timeoutMs">> & { timeoutMs?: number }): Promise<E2D2ApplyProfileResult> {
    const timeoutMs = options.timeoutMs ?? 1000;
    const channels = validateChannels(options.channels, 6);
    const baudIndex = baudRateToIndex(options.baudRate);
    const socketProtocolValue = options.socketProtocol === "tcp" ? 0 : 1;

    for (const channel of channels) {
      await this.dxl.write1(CT.socketProtocolBase + channel - 1, socketProtocolValue, timeoutMs);
      await this.dxl.write2(CT.socketPortBase + (channel - 1) * 2, options.firstSocketPort + channel - 1, timeoutMs);
      await this.writeBaudIndex(channel, baudIndex, timeoutMs);
    }

    if (channels.includes(6)) {
      await this.waitForC5LinkBaudApplied(baudIndex, timeoutMs);
    } else {
      await delay(20);
    }
    await this.dxl.session.flush().catch(() => undefined);
    const modelRaw = await this.dxl.read(0, 7, timeoutMs).catch(() => undefined);
    const verified: E2D2ChannelProfile[] = [];
    for (const channel of channels) {
      const socketProtocol = await this.dxl.read1(CT.socketProtocolBase + channel - 1, timeoutMs);
      const socketPort = await this.dxl.read2(CT.socketPortBase + (channel - 1) * 2, timeoutMs);
      const dxlBaudIndex = await this.dxl.read1(CT.dxlBaudBase + channel - 1, timeoutMs);
      const actualProtocol: "tcp" | "udp" = socketProtocol === 0 ? "tcp" : "udp";
      if (actualProtocol !== options.socketProtocol ||
          socketPort !== options.firstSocketPort + channel - 1 ||
          dxlBaudIndex !== baudIndex) {
        throw new Error(
          `E2D2 channel ${channel} profile verification failed: ` +
          `protocol=${actualProtocol} port=${socketPort} baudIndex=${dxlBaudIndex}`,
        );
      }
      verified.push({
        channel,
        socketPort,
        socketProtocol: actualProtocol,
        dxlBaudRate: E2D2_DXL_BAUD_RATES[dxlBaudIndex] ?? 0,
        dxlBaudIndex,
      });
    }

    return {
      modelNumber: modelRaw == null ? undefined : modelRaw[0] | (modelRaw[1] << 8),
      firmwareVersion: modelRaw?.[6],
      channels: verified,
    };
  }

  async setDxlBaud(options: E2D2SetDxlBaudOptions): Promise<E2D2ChannelBaud[]> {
    const timeoutMs = options.timeoutMs ?? 1000;
    const channels = validateChannels(options.channels, 6);
    const baudIndex = baudRateToIndex(options.baudRate);

    for (const channel of channels) {
      await this.writeBaudIndex(channel, baudIndex, timeoutMs);
    }

    if (channels.includes(6)) {
      await this.waitForC5LinkBaudApplied(baudIndex, timeoutMs);
    } else {
      await delay(20);
    }
    await this.dxl.session.flush().catch(() => undefined);
    const result: E2D2ChannelBaud[] = [];
    for (const channel of channels) {
      const actualIndex = await this.dxl.read1(CT.dxlBaudBase + channel - 1, timeoutMs);
      if (actualIndex !== baudIndex) {
        throw new Error(
          `E2D2 channel ${channel} baud verification failed: ${actualIndex} !== ${baudIndex}`,
        );
      }
      result.push({
        channel,
        dxlBaudRate: E2D2_DXL_BAUD_RATES[actualIndex] ?? 0,
        dxlBaudIndex: actualIndex,
      });
    }
    return result;
  }

  async readChannelSocket(channel: number, timeoutMs = 1000): Promise<E2D2ChannelSocket> {
    const [validated] = validateChannels([channel], 6);
    const protocol = await this.dxl.read1(CT.socketProtocolBase + validated - 1, timeoutMs);
    const socketPort = await this.dxl.read2(CT.socketPortBase + (validated - 1) * 2, timeoutMs);
    return {
      channel: validated,
      socketPort,
      socketProtocol: protocol === 0 ? "tcp" : "udp",
    };
  }

  async readChannelBaud(channel: number, timeoutMs = 1000): Promise<E2D2ChannelBaud> {
    const [validated] = validateChannels([channel], 6);
    const baudIndex = await this.dxl.read1(CT.dxlBaudBase + validated - 1, timeoutMs);
    return {
      channel: validated,
      dxlBaudRate: E2D2_DXL_BAUD_RATES[baudIndex] ?? 0,
      dxlBaudIndex: baudIndex,
    };
  }

  async setChannelSocket(
    channel: number,
    socketProtocol: "tcp" | "udp",
    socketPort: number,
    timeoutMs = 1000,
  ): Promise<E2D2ChannelSocket> {
    const [validated] = validateChannels([channel], 6);
    if (!Number.isInteger(socketPort) || socketPort < 1 || socketPort > 65535) {
      throw new Error(`invalid E2D2 socket port: ${socketPort}`);
    }
    await this.dxl.write1(
      CT.socketProtocolBase + validated - 1,
      socketProtocol === "tcp" ? 0 : 1,
      timeoutMs,
    );
    await this.dxl.write2(
      CT.socketPortBase + (validated - 1) * 2,
      socketPort,
      timeoutMs,
    );
    const actual = await this.readChannelSocket(validated, timeoutMs);
    if (actual.socketProtocol !== socketProtocol || actual.socketPort !== socketPort) {
      throw new Error(
        `E2D2 channel ${validated} socket verification failed: ` +
        `${actual.socketProtocol}:${actual.socketPort}`,
      );
    }
    return actual;
  }

  async waitForC5LinkBaudApplied(baudIndex: number, timeoutMs = 1000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastApplied: number | undefined;
    let lastPending: number | undefined;
    let lastError: unknown;
    while (Date.now() < deadline) {
      const remaining = Math.max(1, deadline - Date.now());
      try {
        const status = await this.dxl.read(
          CT.c5LinkAppliedBaud,
          2,
          Math.min(250, remaining),
        );
        lastApplied = status[0];
        lastPending = status[1];
        lastError = undefined;
        if (lastPending === 0 && lastApplied === baudIndex) {
          return;
        }
      } catch (err) {
        lastError = err;
      }
      await delay(5);
    }
    const state = lastApplied == null
      ? "no status received"
      : `applied index ${lastApplied}, pending ${lastPending}`;
    const detail = lastError instanceof Error ? `; last read error: ${lastError.message}` : "";
    throw new Error(
      `C5 link baud apply timeout: requested index ${baudIndex}; ${state}${detail}`,
    );
  }

  private async writeBaudIndex(
    channel: number,
    baudIndex: number,
    timeoutMs: number,
  ): Promise<void> {
    try {
      await this.dxl.write1(CT.dxlBaudBase + channel - 1, baudIndex, timeoutMs);
    } catch (writeError) {
      if (channel !== 6) {
        throw writeError;
      }
      try {
        await this.waitForC5LinkBaudApplied(baudIndex, timeoutMs);
      } catch (verifyError) {
        const writeDetail = writeError instanceof Error ? writeError.message : String(writeError);
        const verifyDetail = verifyError instanceof Error ? verifyError.message : String(verifyError);
        throw new Error(
          `C5 link baud write was not acknowledged and did not reconcile; ` +
          `write: ${writeDetail}; read-back: ${verifyDetail}`,
        );
      }
    }
  }
}

export function baudRateToIndex(baudRate: number): number {
  const index = E2D2_DXL_BAUD_RATES.indexOf(baudRate as never);
  if (index < 0) {
    throw new Error(`unsupported E2D2 DXL baudrate: ${baudRate}`);
  }
  return index;
}

function validateChannels(channels: number[], maximum: number): number[] {
  if (channels.length === 0) {
    throw new Error("at least one E2D2 channel is required");
  }
  const unique = [...new Set(channels)];
  for (const channel of unique) {
    if (!Number.isInteger(channel) || channel < 1 || channel > maximum) {
      throw new Error(`E2D2 channel out of range: ${channel}`);
    }
  }
  return unique;
}
