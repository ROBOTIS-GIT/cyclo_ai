export interface ImageIdentity {
  boardId: string;
  appBase: number;
  appMaxSize: number;
  firmwareVersion: number;
  modelNumber: number;
}

/** Retained application metadata, independent of the filename. */
export function parseImageIdentity(image: Uint8Array): ImageIdentity | undefined {
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
  const candidates: ImageIdentity[] = [];
  for (let offset = 0; offset + 64 <= image.length; offset += 4) {
    if (view.getUint32(offset, true) !== 0x43594249 ||
        view.getUint16(offset + 4, true) !== 1 || view.getUint16(offset + 6, true) !== 64) continue;
    const name = image.subarray(offset + 20, offset + 52);
    const end = name.indexOf(0);
    if (end < 1 || name.subarray(end).some((value) => value !== 0) ||
        image.subarray(offset + 52, offset + 64).some((value) => value !== 0)) {
      throw new Error("invalid application board identity");
    }
    const boardId = new TextDecoder().decode(name.subarray(0, end));
    if (!/^[a-z0-9_]+$/.test(boardId)) throw new Error("invalid application board ID");
    candidates.push({boardId, appBase: view.getUint32(offset + 8, true),
      appMaxSize: view.getUint32(offset + 12, true),
      firmwareVersion: view.getUint16(offset + 16, true), modelNumber: view.getUint16(offset + 18, true)});
  }
  if (candidates.length > 1) throw new Error("ambiguous application board identity");
  return candidates[0];
}
