import type { ByteTransport, CloseHandler, DataHandler } from "./transport.js";

export interface WebSerialTransportOptions {
  baudRate: number;
  port?: SerialPort;
  onDisconnect?: () => void;
}

const OPEN_RETRY_DELAYS_MS = [0, 150, 500];

export class WebSerialTransport implements ByteTransport {
  readonly label = "WebSerial";
  private port: SerialPort | undefined;
  private reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  private dataHandlers = new Set<DataHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private reading = false;
  private closing = false;
  private readLoopDone: Promise<void> | undefined;
  private closedReason: Error | undefined;
  private suppressClose = false;

  constructor(private options: WebSerialTransportOptions) {
    this.port = options.port;
  }

  get isOpen(): boolean {
    return this.reader !== undefined && this.writer !== undefined;
  }

  setBaudRate(baudRate: number): void {
    this.options.baudRate = baudRate;
  }

  static async request(baudRate: number, onDisconnect?: () => void): Promise<WebSerialTransport> {
    if (!navigator.serial) {
      throw new Error("Web Serial is not available in this browser");
    }
    const port = await navigator.serial.requestPort();
    return new WebSerialTransport({ baudRate, port, onDisconnect });
  }

  async open(): Promise<void> {
    if (this.isOpen) {
      return;
    }
    this.suppressClose = false;
    this.closing = false;
    this.closedReason = undefined;
    if (!this.port) {
      if (!navigator.serial) {
        throw new Error("Web Serial is not available in this browser");
      }
      this.port = await navigator.serial.requestPort();
    }
    if (!this.reader && !this.writer && (this.port.readable || this.port.writable)) {
      await this.close();
    }
    await this.openPortWithRetry(this.port);
    if (!this.port.readable || !this.port.writable) {
      throw new Error("serial port did not expose readable/writable streams");
    }
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
    this.startReadLoop();
  }

  async close(): Promise<void> {
    if (!this.reader && !this.writer && (!this.port || (!this.port.readable && !this.port.writable))) {
      return;
    }
    this.suppressClose = true;
    this.closing = true;
    this.reading = false;
    const port = this.port;
    const reader = this.reader;
    const writer = this.writer;

    await reader?.cancel().catch(() => undefined);
    await this.readLoopDone?.catch(() => undefined);

    if (writer) {
      try {
        writer.releaseLock();
      } catch {
        /* The lock may already be released if the browser closed the stream. */
      }
      if (this.writer === writer) {
        this.writer = undefined;
      }
    }

    try {
      if (port?.readable || port?.writable) {
        await port.close();
      }
    } catch (err) {
      const readableState = port?.readable?.locked ? "locked" : "unlocked";
      const writableState = port?.writable?.locked ? "locked" : "unlocked";
      throw new Error(`serial port close failed after releasing stream locks (readable ${readableState}, writable ${writableState}): ${formatError(err)}`);
    } finally {
      this.closing = false;
      this.suppressClose = false;
      this.closedReason = undefined;
    }
  }

  private async openPortWithRetry(port: SerialPort): Promise<void> {
    let lastError: unknown;
    for (const delayMs of OPEN_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await delay(delayMs);
      }
      try {
        await port.open({ baudRate: this.options.baudRate });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`serial port open failed: ${formatError(lastError)}`);
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error(this.closedReason ? `serial port is not open: ${this.closedReason.message}` : "serial port is not open");
    }
    try {
      await this.writer.write(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`serial write failed: ${message}`);
    }
  }

  async flush(): Promise<void> {
    /* Web Serial has no portable input flush API. */
  }

  onData(handler: DataHandler): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  private startReadLoop(): void {
    if (this.reading || !this.reader) {
      return;
    }
    this.reading = true;
    this.readLoopDone = (async () => {
      let closeReason: Error | undefined;
      try {
        while (this.reading && this.reader) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value) {
            for (const handler of this.dataHandlers) {
              handler(value);
            }
          }
        }
      } catch (err) {
        closeReason = err instanceof Error ? err : new Error(String(err));
      } finally {
        this.reading = false;
        this.closedReason = this.closing ? undefined : closeReason ?? new Error("serial readable stream closed");
        const reader = this.reader;
        this.reader = undefined;
        try {
          reader?.releaseLock();
        } catch {
          /* The lock may already be released if the browser closed the stream. */
        }
        const suppress = this.suppressClose;
        if (!this.closing) {
          this.suppressClose = false;
        }
        if (!suppress) {
          // A receive failure does not necessarily close the writable stream
          // (notably on Linux USB serial). Release our writer and port before
          // announcing disconnection so a replacement transport can reopen it.
          const writer = this.writer;
          try {
            writer?.releaseLock();
            this.writer = undefined;
            if (this.port?.readable || this.port?.writable) {
              await this.port.close();
            }
          } catch (err) {
            closeReason = new Error(`${formatError(this.closedReason)}; serial cleanup failed: ${formatError(err)}`);
            this.closedReason = closeReason;
          }
          this.options.onDisconnect?.();
          for (const handler of this.closeHandlers) {
            handler(closeReason);
          }
        }
      }
    })();
  }
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
