// Resolve live indirect mappings to a complete canonical target, never a raw grant.
import { decode, encode } from './registry.mjs';
export async function aliasPlan(items, origin, value, connection, id) {
  const byName = new Map(items.map((i) => [i.name, i]));
  const mappingEvidence = new Map();
  const dataAt = (address) =>
    items.find((i) => i.address === address && i.name.startsWith('Indirect Data '));
  const fieldAt = (address) => {
    const candidates = items.filter(
      (i) =>
        !i.name.startsWith('Indirect Data ') &&
        i.address <= address &&
        address < i.address + i.width,
    );
    if (candidates.length !== 1)
      throw Error('Indirect mapping points to an unknown/reserved/ambiguous canonical byte');
    return candidates[0];
  };
  const resolve = async (data, seen = new Set(), depth = 0) => {
    if (depth >= 8 || seen.has(data.key)) throw Error('Indirect mapping cycle or traversal limit');
    seen = new Set(seen).add(data.key);
    const number = data.name.slice('Indirect Data '.length),
      mapping = byName.get('Indirect Address ' + number);
    if (!mapping || mapping.write.status !== 'resolved')
      throw Error('Indirect mapping descriptor is unresolved');
    const address = decode(await connection.read(id, mapping.address, mapping.width));
    if (
      mapping.write.bounds &&
      (address < mapping.write.bounds[0] || address > mapping.write.bounds[1])
    )
      throw Error('Indirect mapping is unconfigured/outside its documented domain');
    mappingEvidence.set(mapping.key, { item: mapping.key, value: address });
    const next = dataAt(address);
    if (next) return resolve(next, seen, depth + 1);
    const target = fieldAt(address);
    return { target, offset: address - target.address };
  };
  const selected = await resolve(origin);
  const { target, offset } = selected;
  if (!['RW', 'R/RW'].includes(target.access) || target.write.status !== 'resolved')
    throw Error('Indirect destination is read-only or has unresolved write semantics');
  const start = origin.address - offset;
  for (let byte = 0; byte < target.width; byte++) {
    const data = dataAt(start + byte);
    if (!data)
      throw Error('Complete sequential indirect mapping is required for a multi-byte item');
    const found = await resolve(data);
    if (found.target.key !== target.key || found.offset !== byte)
      throw Error('Indirect group does not map every byte of one complete item sequentially');
  }
  if (target.name.startsWith('Indirect Address ') && mappingEvidence.has(target.key))
    throw Error(
      'Self-modifying alias mapping is not an atomic documented operation; write its mapping item directly',
    );
  const bytes = Uint8Array.from(await connection.read(id, target.address, target.width));
  if (bytes.length !== target.width) throw Error('Indirect destination snapshot width mismatch');
  bytes[offset] = value;
  const effectiveValue = decode(
    bytes,
    target.write.encoding === 'twos-complement' ? 'twos-complement' : 'unsigned',
  );
  return {
    item: target,
    value: effectiveValue,
    address: start,
    bytes,
    mappingEvidence: [...mappingEvidence.values()],
    requestedByteOffset: offset,
  };
}
