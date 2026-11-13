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
      model.protocol !== first.model.protocol ||
      target.port !== first.target.port ||
      target.baud !== first.target.baud
    )
      throw Error('Group Read requires one selected bus, protocol and baud');
    if (
      item.readStatus !== 'resolved-raw' ||
      target.firmware < (item.minimumFirmware ?? 0) ||
      (item.protocols && !item.protocols.includes(model.protocol))
    )
      throw Error('All targets need a resolved item for this firmware/protocol');
    if (
      model.protocol === 1 &&
      (model.customHash ||
        !/^(mx_series|x_series)\//.test(model.catalogId) ||
        model.catalogId.includes('xl-320') ||
        item.address + item.width > 256 ||
        item.width > 244)
    )
      throw Error('Protocol1 Bulk Read is unsupported for this model/layout');
  }
  if (first.model.protocol === 1 && entries.length < 2)
    throw Error('Protocol1 Bulk Read requires multiple targets');
  return entries;
}
export async function readManyItems(connect, targets, key, { signal } = {}) {
  const entries = groupPlan(targets, key),
    first = entries[0];
  let c,
    closureUnconfirmed = false;
  const result = {
    outcome: 'read',
    items: [],
    instruction:
      first.model.protocol === 2 &&
      entries.every(
        (e) => e.item.address === first.item.address && e.item.width === first.item.width,
      )
        ? 'syncRead'
        : 'bulkRead',
    meaning: 'Grouped reads do not guarantee simultaneous physical sampling',
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
    c = await connect(first.target.baud, 100, first.model.protocol);
    await check();
    if (!c[result.instruction])
      throw Error('Provider does not expose native ' + result.instruction);
    const responses = [];
    const batches = readBatches(entries, Math.max(...entries.map((e) => e.item.width)));
    if (result.instruction === 'bulkRead' && batches.length > 1 && batches.at(-1).length === 1) {
      batches.at(-1).unshift(batches.at(-2).pop());
    }
    for (const batch of batches) {
      if (signal?.aborted) throw Error('Group Read cancelled');
      responses.push(
        ...(result.instruction === 'syncRead'
          ? await c.syncRead(
              batch.map((e) => e.target.id),
              first.item.address,
              first.item.width,
            )
          : await c.bulkRead(
              batch.map((e) => ({
                id: e.target.id,
                address: e.item.address,
                size: e.item.width,
                catalogId: e.model.catalogId,
              })),
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

// Internal compatibility for existing callers; public API uses read_many.
export const syncReadItems = readManyItems;
