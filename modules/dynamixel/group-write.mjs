import { modelFor, encode } from './registry.mjs';
import { itemFor, writeRequest } from './table.mjs';

// A coordinated request always produces exactly one packet, never sequential writes.
export function planGroupWrite(writes) {
  if (!Array.isArray(writes) || writes.length < 2 || writes.length > 253)
    throw Error('Choose 2..253 distinct selected targets');
  const entries = writes.map(({ target, item: key, value }) => {
    const model = modelFor(target.model, target.firmware, target.catalogId, target.protocol);
    const item = itemFor(model, key);
    writeRequest(model, item, value);
    if (
      item.memory !== 'RAM' ||
      item.write.kind !== 'direct' ||
      item.readStatus !== 'resolved-raw' ||
      /^(Profile |.*Limit$|.*Mode.*|Lock$|.*Watchdog$|Secondary)/.test(item.name)
    )
      throw Error(
        'Group writes require a direct readable RAM item without configuration side effects',
      );
    if (!target.addressingVerified && !target.isolatedBus)
      throw Error('Verify unique addressing before group writes');
    return {
      target,
      model,
      item,
      value,
      bytes: [...encode(value, item.width, item.write.encoding)],
    };
  });
  const first = entries[0],
    protocol = first.model.protocol;
  if (new Set(entries.map((e) => e.target.id)).size !== entries.length)
    throw Error('Choose distinct primary IDs');
  for (const e of entries) {
    if (
      e.target.port !== first.target.port ||
      e.target.baud !== first.target.baud ||
      e.model.protocol !== protocol
    )
      throw Error('Group writes require one bus, baud and protocol');
    if (e.target.id < 0 || e.target.id > (protocol === 1 ? 253 : 252))
      throw Error('Invalid unicast ID');
  }
  const same = entries.every(
    (e) => e.item.address === first.item.address && e.item.width === first.item.width,
  );
  if (!same && protocol !== 2)
    throw Error('Protocol1 Sync Write requires the same address and width');
  const instruction = same ? 'syncWrite' : 'bulkWrite';
  const params = same
    ? protocol === 1
      ? [first.item.address, first.item.width]
      : [
          first.item.address & 255,
          first.item.address >> 8,
          first.item.width & 255,
          first.item.width >> 8,
        ]
    : [];
  for (const e of entries) {
    if (protocol === 1 && (e.item.address + e.item.width > 256 || e.item.width > 255))
      throw Error('Protocol1 item exceeds address bounds');
    params.push(e.target.id);
    if (!same)
      params.push(e.item.address & 255, e.item.address >> 8, e.item.width & 255, e.item.width >> 8);
    params.push(...e.bytes);
  }
  let packetBytes = (protocol === 1 ? 6 : 10) + params.length;
  if (protocol === 2) {
    const body = [same ? 0x83 : 0x93, ...params];
    for (let i = 2; i < body.length; i++)
      if (body[i - 2] === 255 && body[i - 1] === 255 && body[i] === 253) packetBytes++;
  }
  if (packetBytes > (protocol === 1 ? 250 : 1024))
    throw Error('Coordinated request exceeds one SDK packet; no automatic splitting');
  return { instruction, protocol, entries, packetBytes };
}

export async function writeManyItems(connect, writes, { signal } = {}) {
  const plan = planGroupWrite(writes),
    first = plan.entries[0];
  const result = {
    outcome: 'not_written',
    instruction: plan.instruction,
    packetBytes: plan.packetBytes,
    items: [],
    meaning: 'Register readback is not proof of physical motion or simultaneous arrival',
  };
  let c,
    attempted = false,
    closureUnconfirmed = false;
  try {
    if (signal?.aborted) throw Error('Group write cancelled');
    c = await connect(first.target.baud, 100, plan.protocol);
    if (!c.writeGroup) throw Error('Provider lacks validated native group writes');
    const entries = plan.entries.map(({ target, model, item, value }) => ({
      catalogId: model.catalogId,
      ...(model.customHash ? { tableHash: model.customHash } : {}),
      id: target.id,
      model: target.model,
      firmware: target.firmware,
      peerIds: target.peerIds ?? [],
      tableItem: item.key,
      value,
    }));
    if (signal?.aborted) throw Error('Group write cancelled');
    // Once handed to the bridge, a lost response cannot establish whether transmission began.
    attempted = true;
    const response = await c.writeGroup({ instruction: plan.instruction, entries }, { signal });
    Object.assign(result, response);
    if (signal?.aborted && response.transmission?.attempted) {
      result.outcome = 'uncertain';
      result.error = 'Group write cancelled after transmission; no retry';
    }
  } catch (e) {
    result.outcome = attempted ? 'uncertain' : 'not_written';
    result.error = e.message;
    if (e.name === 'TransportClosureError') closureUnconfirmed = true;
  } finally {
    if (c)
      try {
        await c.close();
      } catch (e) {
        closureUnconfirmed = true;
        result.error = e.message;
        result.outcome = attempted ? 'uncertain' : 'not_written';
      }
  }
  result.closureConfirmed = !closureUnconfirmed;
  return result;
}
