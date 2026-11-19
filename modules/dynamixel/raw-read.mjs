import { readBatches } from './read-batches.mjs';
import { identify } from './identity.mjs';
// Explicit bounded byte inspection for controllers/sensors without an actuator
// catalog contract. This path never binds or exposes a write operation.
export async function inspectBytes(connect, request, { signal } = {}) {
  const { ids, baud, protocol, address, length, synchronized = false } = request;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > (protocol === 1 ? 254 : 253) ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !Number.isInteger(id) || id < 0 || id > (protocol === 1 ? 253 : 252))
  )
    throw Error('Choose unique valid unicast IDs');
  if (![1, 2].includes(protocol) || (synchronized && protocol !== 2))
    throw Error('Choose an explicit supported packet protocol');
  if (
    address !== undefined &&
    (!Number.isInteger(address) ||
      !Number.isInteger(length) ||
      length < 1 ||
      length > 1024 ||
      address < 0 ||
      address + length > (protocol === 1 ? 256 : 65536))
  )
    throw Error('Invalid bounded raw register range');
  if (!Number.isInteger(baud) || baud < 9600 || baud > 12000000)
    throw Error('Invalid requested host baud');
  const result = {
    outcome: 'read',
    identities: [],
    items: [],
    interpretation:
      'Raw bytes only; no catalog, signed encoding, physical units or write permission is inferred',
  };
  let c,
    uncertain = false;
  const check = async () => {
    const found = [];
    for (const id of ids) {
      if (signal?.aborted) throw Error('Inspection cancelled');
      const p = await c.probe(id);
      if (!p || p.id !== id || p.statusError)
        throw Error(p?.statusError ?? 'Requested ID did not respond');
      if (
        request.expected &&
        ((p.modelNumber !== undefined && p.modelNumber !== request.expected.model) ||
          (p.firmwareVersion !== undefined && p.firmwareVersion !== request.expected.firmware))
      )
        throw Error('Configured target identity changed');
      if (
        protocol === 2 &&
        (!Number.isInteger(p.modelNumber) || !Number.isInteger(p.firmwareVersion))
      )
        throw Error('Incomplete Protocol2 Ping identity');
      if (protocol === 1 && request.expected) {
        const proof = await identify(c, id, protocol, { catalogId: request.expected.catalogId });
        if (
          !proof?.identityComplete ||
          proof.modelNumber !== request.expected.model ||
          proof.firmwareVersion !== request.expected.firmware
        )
          throw Error('Configured Protocol1 identity requires its exact source contract');
        found.push(proof);
      } else found.push(p);
    }
    return found;
  };
  try {
    if (signal?.aborted) throw Error('Inspection cancelled');
    c = await connect(baud, 100, protocol);
    result.identities = await check();
    if (address !== undefined) {
      if (synchronized) {
        if (!c.syncRead) throw Error('Provider lacks Sync Read');
        const batches = readBatches(ids, length);
        for (const batch of batches) {
          if (signal?.aborted) throw Error('Inspection cancelled');
          result.items.push(...(await c.syncRead(batch, address, length)));
        }
        result.batchCount = batches.length;
      } else
        for (const id of ids) {
          if (signal?.aborted) throw Error('Inspection cancelled');
          result.items.push({ id, bytes: [...(await c.read(id, address, length))] });
        }
      if (
        result.items.length !== ids.length ||
        ids.some(
          (id) => result.items.filter((i) => i.id === id && i.bytes.length === length).length !== 1,
        )
      )
        throw Error('Read ID/width mismatch');
      const after = await check();
      if (JSON.stringify(after) !== JSON.stringify(result.identities))
        throw Error('Responder identity changed during read');
    }
  } catch (e) {
    result.outcome = 'failed';
    result.error = e.message;
    if (e.name === 'TransportClosureError') uncertain = true;
  } finally {
    if (c)
      try {
        await c.close();
      } catch (e) {
        result.outcome = 'failed';
        result.error = e.message;
        uncertain = true;
      }
  }
  result.closureConfirmed = !uncertain;
  return result;
}
