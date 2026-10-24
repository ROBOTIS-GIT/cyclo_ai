export type DataHandler = (data: Uint8Array) => void;
export type CloseHandler = (reason?: Error) => void;

/** The connector could not confirm cleanup; opening another session is unsafe. */
export class TransportClosureError extends Error {
  override name = "TransportClosureError";
}

export interface ByteTransport {
  readonly isOpen: boolean;
  readonly label?: string;
  setBaudRate?(baudRate: number): void;
  open(): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  flush?(): Promise<void>;
  onData(handler: DataHandler): () => void;
  onClose?(handler: CloseHandler): () => void;
}

export function isDisconnectError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const code = (err as Error & { code?: string }).code;
  return code === "ENODEV" || code === "ENOENT" || code === "EIO" || code === "EBADF" ||
    /disconnect|closed|not open|no such device|network|device/i.test(err.message);
}

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
