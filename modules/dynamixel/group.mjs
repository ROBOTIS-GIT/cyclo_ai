import { readValue } from './read-value.mjs';
import { readBatches } from './read-batches.mjs';
import { modelFor } from './registry.mjs';
import { itemFor } from './table.mjs';
import { identify } from './identity.mjs';

export function groupPlan(targets, key) {
  if (
    !targets.length ||
    targets.length > 253 ||
    new Set(targets.map((t) => t.id)).size !== targets.length
  )
    throw Error('Choose distinct selected unicast IDs');
  const entries = targets.map((target) => {
    const model = modelFor(target.model, target.firmware, target.catalogId, target.protocol),
      item = itemFor(model, key);
    return { target, model, item };
  });
  const first = entries[0];
  for (const { target, model, item } of entries) {
    if (
      model.protocol !== 2 ||
      target.port !== first.target.port ||
      target.baud !== first.target.baud
    )
      throw Error('Sync Read requires one selected Protocol 2 bus and baud');
    if (
      item.address !== first.item.address ||
      item.width !== first.item.width ||
      item.readStatus !== 'resolved-raw' ||
      target.firmware < (item.minimumFirmware ?? 0) ||
      (item.protocols && !item.protocols.includes(2))
    )
      throw Error('All targets need the same resolved item address/width for this firmware');
  }
  return entries;
}
export async function syncReadItems(connect, targets, key, { signal } = {}) {
  const entries = groupPlan(targets, key),
    first = entries[0];
  let c,
    closureUnconfirmed = false;
  const result = {
    outcome: 'read',
    items: [],
    instruction: 'Protocol 2 Sync Read; no write or atomic physical sampling claim',
  };
  const check = async () => {
    for (const { target, model } of entries) {
      if (signal?.aborted) throw Error('Sync Read cancelled');
      const proof = await identify(c, target.id, model.protocol, { catalogId: model.catalogId });
      if (
        !proof?.identityComplete ||
        proof.modelNumber !== target.model ||
        proof.firmwareVersion !== target.firmware
      )
        throw Error('Sync Read target identity changed');
    }
  };
  try {
    if (signal?.aborted) throw Error('Sync Read cancelled');
    c = await connect(first.target.baud, 100, 2);
    await check();
    if (!c.syncRead) throw Error('Provider does not expose native Sync Read');
    const responses = [];
    const batches = readBatches(targets, first.item.width);
    for (const batch of batches) {
      if (signal?.aborted) throw Error('Sync Read cancelled');
      responses.push(
        ...(await c.syncRead(
          batch.map((t) => t.id),
          first.item.address,
          first.item.width,
        )),
      );
    }
    result.batchCount = batches.length;
    if (responses.length !== entries.length) throw Error('Incomplete Sync Read response set');
    for (const { target, item } of entries) {
      const matches = responses.filter((r) => r.id === target.id);
      if (matches.length !== 1 || matches[0].bytes.length !== item.width)
        throw Error('Sync Read ID/width mismatch');
      const bytes = Uint8Array.from(matches[0].bytes);
      result.items.push({
        id: target.id,
        item: item.key,
        bytes: [...bytes],
        encoding: item.encoding,
        ...readValue(bytes, item.encoding),
        unit: item.unit,
        scale: item.scale,
        source: item.source,
      });
    }
    await check();
  } catch (e) {
    result.outcome = 'failed';
    result.error = e.message;
    if (e.name === 'TransportClosureError') closureUnconfirmed = true;
  } finally {
    if (c)
      try {
        await c.close();
      } catch (e) {
        closureUnconfirmed = true;
        result.outcome = 'failed';
        result.error = e.message;
      }
  }
  result.closureConfirmed = !closureUnconfirmed;
  return result;
}
