// Bound individual SDK requests without limiting the user's selected device set.
export function readBatches(entries, width, { maxIds = 16, maxBytes = 4096 } = {}) {
  if (!Number.isInteger(width) || width < 1 || width > maxBytes) throw Error('Invalid read width');
  const size = Math.min(maxIds, Math.floor(maxBytes / width));
  const batches = [];
  for (let offset = 0; offset < entries.length; offset += size)
    batches.push(entries.slice(offset, offset + size));
  return batches;
}
