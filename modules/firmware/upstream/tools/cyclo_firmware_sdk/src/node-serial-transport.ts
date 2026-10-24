import { SerialPort } from "serialport";
import type { ByteTransport, CloseHandler, DataHandler } from "./transport.js";
import { TransportClosureError } from "./transport.js";

export interface NodeSerialTransportOptions {
  path: string;
  baudRate: number;
}

export interface NodeSerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  pnpId?: string;
  locationId?: string;
}

export class NodeSerialTransport implements ByteTransport {
  readonly label: string;
  private port: SerialPort | undefined;
  private dataHandlers = new Set<DataHandler>();
  private closeHandlers = new Set<CloseHandler>();

  constructor(private options: NodeSerialTransportOptions) {
    this.label = options.path;
  }

  get path(): string {
    return this.options.path;
  }

  get baudRate(): number {
    return this.options.baudRate;
  }

  setBaudRate(baudRate: number): void {
    this.options.baudRate = baudRate;
  }

  get isOpen(): boolean {
    return this.port?.isOpen ?? false;
  }

  async open(): Promise<void> {
    if (this.port) {
      throw new Error("serial transport still owns a port; confirm closure before reopening");
    }
    const port = new SerialPort({ path: this.options.path, baudRate: this.options.baudRate, autoOpen: false });
    this.port = port;
    port.on("data", (data: Buffer) => {
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      for (const handler of this.dataHandlers) {
        handler(bytes.slice());
      }
    });
    port.on("close", () => {
      for (const handler of this.closeHandlers) {
        handler(new Error("serial port closed"));
      }
    });
    port.on("error", (err) => {
      for (const handler of this.closeHandlers) {
        handler(err);
      }
    });
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((err) => err ? reject(err) : resolve());
      });
      await settleAfterOpen(port, this.options.baudRate);
    } catch (error) {
      try { await this.close(); }
      catch (cleanupError) {
        throw new TransportClosureError(
          `Serial open failed (${error instanceof Error ? error.message : 'unknown error'}); closure unconfirmed`,
          { cause: cleanupError },
        );
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    const port = this.port;
    if (!port || !port.isOpen) {
      this.port = undefined;
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        port.close((err) => err ? reject(err) : resolve());
      });
    } catch (error) {
      // Retain the handle: a second open must not hide an unconfirmed close.
      throw new TransportClosureError("Serial port closure unconfirmed", { cause: error });
    }
    this.port = undefined;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      throw new Error("serial port is not open");
    }
    const payload = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    await new Promise<void>((resolve, reject) => {
      this.port?.write(payload, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.port?.drain((drainErr) => drainErr ? reject(drainErr) : resolve());
      });
    });
  }

  async flush(): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.port?.flush((err) => err ? reject(err) : resolve());
    });
  }

  onData(handler: DataHandler): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  static async listPorts(): Promise<NodeSerialPortInfo[]> {
    return SerialPort.list();
  }
}

function lowBaudOpenSettleMs(baudRate: number): number {
  if (baudRate <= 9600) {
    return 250;
  }
  if (baudRate <= 57600) {
    return 100;
  }
  if (baudRate <= 115200) {
    return 50;
  }
  return 0;
}

async function settleAfterOpen(port: SerialPort, baudRate: number): Promise<void> {
  const settleMs = lowBaudOpenSettleMs(baudRate);
  if (settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
  }
  await new Promise<void>((resolve, reject) => {
    port.flush((err) => err ? reject(err) : resolve());
  });
}
