import net from "node:net";

import type { ByteTransport, CloseHandler, DataHandler } from "./transport.js";

export interface NodeTcpTransportOptions {
  host: string;
  port: number;
}

export class NodeTcpTransport implements ByteTransport {
  readonly label: string;
  private socket: net.Socket | undefined;
  private dataHandlers = new Set<DataHandler>();
  private closeHandlers = new Set<CloseHandler>();

  constructor(private options: NodeTcpTransportOptions) {
    this.label = `${options.host}:${options.port}`;
  }

  setBaudRate(_baudRate: number): void {
    /* TCP carries an already-configured byte stream; baud changes are not meaningful. */
  }

  get isOpen(): boolean {
    return this.socket != null && !this.socket.destroyed;
  }

  async open(): Promise<void> {
    if (this.isOpen) {
      return;
    }

    const socket = net.createConnection({
      host: this.options.host,
      port: this.options.port,
      noDelay: true,
    });

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        socket.off("connect", onConnect);
        socket.off("error", onError);
      };
      socket.once("connect", onConnect);
      socket.once("error", onError);
    });

    this.socket = socket;
    socket.on("data", (data: Buffer) => {
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      for (const handler of this.dataHandlers) {
        handler(bytes.slice());
      }
    });
    socket.on("close", () => {
      for (const handler of this.closeHandlers) {
        handler(new Error("tcp socket closed"));
      }
    });
    socket.on("error", (err) => {
      for (const handler of this.closeHandlers) {
        handler(err);
      }
    });
  }

  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = undefined;
    if (!socket || socket.destroyed) {
      return;
    }
    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.end();
      setTimeout(() => {
        if (!socket.destroyed) {
          socket.destroy();
        }
        resolve();
      }, 100);
    });
  }

  async write(data: Uint8Array): Promise<void> {
    const socket = this.socket;
    if (!socket || socket.destroyed) {
      throw new Error("tcp socket is not open");
    }
    const payload = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    await new Promise<void>((resolve, reject) => {
      socket.write(payload, (err) => err ? reject(err) : resolve());
    });
  }

  async flush(): Promise<void> {
    /* PacketSession clears its parser buffers. TCP itself has no portable input flush. */
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
