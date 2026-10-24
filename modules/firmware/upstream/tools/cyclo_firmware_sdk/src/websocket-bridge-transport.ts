import type { ByteTransport, CloseHandler, DataHandler } from "./transport.js";

export interface WebSocketBridgeTransportOptions {
  url: string;
  serialPath?: string;
  baudRate?: number;
}

type BridgeMessage =
  | { type: "open"; ok?: boolean; serialPath?: string; baudRate?: number; message?: string }
  | { type: "close"; ok?: boolean; message?: string }
  | { type: "error"; message: string }
  | { type: "status"; open: boolean; serialPath?: string; baudRate?: number };

export class WebSocketBridgeTransport implements ByteTransport {
  readonly label = "WebSocket Bridge";
  private ws: WebSocket | undefined;
  private dataHandlers = new Set<DataHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private closing = false;

  constructor(private options: WebSocketBridgeTransportOptions) {}

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  setBaudRate(baudRate: number): void {
    this.options.baudRate = baudRate;
  }

  async open(): Promise<void> {
    const ws = new WebSocket(this.options.url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("WebSocket bridge connection failed"));
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
    });

    ws.addEventListener("message", (event) => this.handleMessage(event.data));
    ws.addEventListener("close", () => {
      if (this.closing) {
        return;
      }
      for (const handler of this.closeHandlers) {
        handler(new Error("WebSocket bridge closed"));
      }
    });
    ws.addEventListener("error", () => {
      if (this.closing) {
        return;
      }
      for (const handler of this.closeHandlers) {
        handler(new Error("WebSocket bridge error"));
      }
    });

    await this.control({
      type: "open",
      serialPath: this.options.serialPath,
      baudRate: this.options.baudRate,
    });
  }

  async close(): Promise<void> {
    const ws = this.ws;
    if (!ws) {
      return;
    }

    this.closing = true;
    try {
      if (ws.readyState === WebSocket.OPEN) {
        await this.control({ type: "close" });
      }
    } finally {
      await closeWebSocket(ws);
      if (this.ws === ws) {
        this.ws = undefined;
      }
      this.closing = false;
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket bridge is not open");
    }
    this.ws.send(data);
  }

  async flush(): Promise<void> {
    await this.control({ type: "flush" });
  }

  onData(handler: DataHandler): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  private async control(message: Record<string, unknown>): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket bridge is not open");
    }
    const expectedType = String(message.type);
    const ws = this.ws;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        ws.removeEventListener("message", onMessage);
        reject(new Error(`bridge ${expectedType} timeout`));
      }, 3000);
      const onMessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") {
          return;
        }
        const parsed = JSON.parse(event.data) as BridgeMessage;
        if (parsed.type === "error") {
          window.clearTimeout(timer);
          ws.removeEventListener("message", onMessage);
          reject(new Error(parsed.message));
          return;
        }
        if (parsed.type === expectedType) {
          window.clearTimeout(timer);
          ws.removeEventListener("message", onMessage);
          if ("ok" in parsed && parsed.ok === false) {
            reject(new Error(parsed.message ?? `bridge ${expectedType} failed`));
          } else {
            resolve();
          }
        }
      };
      ws.addEventListener("message", onMessage);
      ws.send(JSON.stringify(message));
    });
  }

  private handleMessage(data: unknown): void {
    if (typeof data === "string") {
      return;
    }
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) :
      ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) :
        undefined;
    if (!bytes) {
      return;
    }
    for (const handler of this.dataHandlers) {
      handler(bytes);
    }
  }
}

function closeWebSocket(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 1000);
    const cleanup = () => {
      window.clearTimeout(timer);
      ws.removeEventListener("close", onClose);
    };
    const onClose = () => {
      cleanup();
      resolve();
    };
    ws.addEventListener("close", onClose);
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
      return;
    }
    ws.close();
  });
}
