import dgram from "node:dgram";
import { performance } from "node:perf_hooks";

import type { ByteTransport, CloseHandler, DataHandler } from "./transport.js";

export interface NodeUdpTransportOptions {
  host: string;
  port: number;
}

export class NodeUdpTransport implements ByteTransport {
  readonly label: string;
  private socket: dgram.Socket | undefined;
  private dataHandlers = new Set<DataHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private dropIncoming = false;
  private lastDroppedAt = 0;

  constructor(private options: NodeUdpTransportOptions) {
    this.label = `${options.host}:${options.port}/udp`;
  }

  get isOpen(): boolean {
    return this.socket != null;
  }

  setBaudRate(_baudRate: number): void {
    /* UDP carries an already-configured bridge byte stream. */
  }

  async open(): Promise<void> {
    if (this.socket != null) {
      return;
    }

    const socket = dgram.createSocket("udp4");
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("error", onError);
        socket.off("listening", onListening);
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onListening = () => {
        cleanup();
        resolve();
      };
      socket.once("error", onError);
      socket.once("listening", onListening);
      socket.bind(0);
    });
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("error", onError);
        socket.off("connect", onConnect);
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onConnect = () => {
        cleanup();
        resolve();
      };
      socket.once("error", onError);
      socket.once("connect", onConnect);
      socket.connect(this.options.port, this.options.host);
    });
    socket.on("message", (message) => {
      const bytes = new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
      if (this.dropIncoming) {
        this.lastDroppedAt = performance.now();
        return;
      }
      for (const handler of this.dataHandlers) {
        handler(bytes.slice());
      }
    });
    socket.on("error", (err) => {
      for (const handler of this.closeHandlers) {
        handler(err);
      }
    });
    socket.on("close", () => {
      for (const handler of this.closeHandlers) {
        handler(new Error("udp socket closed"));
      }
    });
    this.socket = socket;
  }

  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = undefined;
    if (socket == null) {
      return;
    }
    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }

  async write(data: Uint8Array): Promise<void> {
    const socket = this.socket;
    if (socket == null) {
      throw new Error("udp socket is not open");
    }
    const payload = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    await new Promise<void>((resolve, reject) => {
      socket.send(payload, (err) => err ? reject(err) : resolve());
    });
  }

  async flush(): Promise<void> {
    const quietMs = 8;
    const maxMs = 80;
    const startedAt = performance.now();
    this.dropIncoming = true;
    this.lastDroppedAt = startedAt;
    try {
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, quietMs));
        const now = performance.now();
        if (now - this.lastDroppedAt >= quietMs || now - startedAt >= maxMs) {
          return;
        }
      }
    } finally {
      this.dropIncoming = false;
    }
  }

  onData(handler: DataHandler): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }
}
