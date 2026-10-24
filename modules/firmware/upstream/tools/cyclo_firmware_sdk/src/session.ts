import { PacketStream } from "./protocol.js";
import type { ByteTransport } from "./transport.js";

type PacketWaiter = {
  resolve: (packet: Uint8Array) => void;
  reject: (err: Error) => void;
};

type ByteWaiter = {
  expected: number;
  resolve: (found: boolean) => void;
};

export class PacketSession {
  private stream = new PacketStream();
  private packetWaiters: PacketWaiter[] = [];
  private byteWaiters: ByteWaiter[] = [];
  private pendingPackets: Uint8Array[] = [];
  private removeDataHandler: (() => void) | undefined;
  private removeCloseHandler: (() => void) | undefined;

  constructor(readonly transport: ByteTransport) {}

  async open(): Promise<void> {
    await this.transport.open();
    this.attach();
  }

  async close(): Promise<void> {
    this.detach();
    await this.transport.close();
  }

  attach(): void {
    if (this.removeDataHandler) {
      return;
    }
    this.removeDataHandler = this.transport.onData((data) => this.handleData(data));
    this.removeCloseHandler = this.transport.onClose?.((reason) => this.rejectPacketWaiters(reason ?? new Error("transport closed")));
  }

  detach(): void {
    this.removeDataHandler?.();
    this.removeCloseHandler?.();
    this.removeDataHandler = undefined;
    this.removeCloseHandler = undefined;
    this.stream.clear();
    this.pendingPackets = [];
    this.packetWaiters = [];
    this.byteWaiters = [];
  }

  async write(data: Uint8Array): Promise<void> {
    await this.transport.write(data);
  }

  async flush(_options: { quietMs?: number; maxMs?: number } = {}): Promise<void> {
    await this.transport.flush?.();
    this.stream.clear();
    this.pendingPackets = [];
  }

  waitForPacket(timeoutMs: number): Promise<Uint8Array> {
    const pending = this.pendingPackets.shift();
    if (pending) {
      return Promise.resolve(pending);
    }

    return new Promise((resolve, reject) => {
      const waiter: PacketWaiter = { resolve, reject };
      const timer = setTimeout(() => {
        const index = this.packetWaiters.indexOf(waiter);
        if (index >= 0) {
          this.packetWaiters.splice(index, 1);
        }
        reject(new Error("packet timeout"));
      }, timeoutMs);
      waiter.resolve = (packet) => {
        clearTimeout(timer);
        resolve(packet);
      };
      this.packetWaiters.push(waiter);
    });
  }

  waitForByte(expected: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const waiter: ByteWaiter = { expected, resolve };
      const timer = setTimeout(() => {
        const index = this.byteWaiters.indexOf(waiter);
        if (index >= 0) {
          this.byteWaiters.splice(index, 1);
        }
        resolve(false);
      }, timeoutMs);
      waiter.resolve = (found) => {
        clearTimeout(timer);
        resolve(found);
      };
      this.byteWaiters.push(waiter);
    });
  }

  private handleData(data: Uint8Array): void {
    if (this.byteWaiters.length > 0) {
      const remaining: ByteWaiter[] = [];
      for (const waiter of this.byteWaiters) {
        if (data.includes(waiter.expected)) {
          waiter.resolve(true);
        } else {
          remaining.push(waiter);
        }
      }
      this.byteWaiters = remaining;
    }

    for (const packet of this.stream.push(data)) {
      const waiter = this.packetWaiters.shift();
      if (waiter) {
        waiter.resolve(packet);
      } else {
        this.pendingPackets.push(packet);
      }
    }
  }

  private rejectPacketWaiters(err: Error): void {
    for (const waiter of this.packetWaiters.splice(0)) {
      waiter.reject(err);
    }
  }
}
