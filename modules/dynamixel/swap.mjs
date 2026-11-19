import { configure, validateRequest } from './workflow.mjs';
import { modelFor, decode, readsFor } from './registry.mjs';
import { identify } from './identity.mjs';
import { itemFor, validateConditions } from './table.mjs';

export async function swapIds(connect, a, b, temporaryId, { signal } = {}) {
  const first = modelFor(a.model, a.firmware, a.catalogId, a.protocol),
    second = modelFor(b.model, b.firmware, b.catalogId, b.protocol);
  a = { ...a, protocol: first.protocol };
  b = { ...b, protocol: second.protocol };
  if (a.port !== b.port || a.baud !== b.baud || a.protocol !== b.protocol || a.id === b.id)
    throw Error('Swap requires distinct selected IDs on one bus/protocol/baud');
  if (first.dualAxis || second.dualAxis)
    throw Error('Dual-axis ID swaps need a source-specific endpoint/cohort procedure');
  if (
    !Number.isInteger(temporaryId) ||
    temporaryId < 0 ||
    temporaryId > Math.min(first.idMaximum, second.idMaximum) ||
    [a.id, b.id].includes(temporaryId)
  )
    throw Error('Choose a valid distinct temporary ID');
  const stages = [
    [a, temporaryId],
    [b, a.id],
    [{ ...a, id: temporaryId }, b.id],
  ];
  for (const [t, id] of stages) validateRequest({ ...t, changes: { id } });
  const result = {
    outcome: 'not_written',
    stages: [],
    locations: {
      a: { id: a.id, baud: a.baud, protocol: a.protocol },
      b: { id: b.id, baud: b.baud, protocol: b.protocol },
    },
    closureConfirmed: true,
  };
  let preflight;
  try {
    if (signal?.aborted) throw Error('Swap cancelled before writing');
    preflight = await connect(a.baud, 100, a.protocol);
    if (await preflight.probe(temporaryId)) throw Error('Temporary ID is occupied');
    for (const [t, id] of stages.slice(0, 2)) {
      const model = modelFor(t.model, t.firmware, t.catalogId, t.protocol),
        proof = await identify(preflight, t.id, t.protocol, { catalogId: model.catalogId });
      if (
        !proof?.identityComplete ||
        proof.modelNumber !== t.model ||
        proof.firmwareVersion !== t.firmware
      )
        throw Error('Swap source identity changed');
      const read = async (name) => {
        const item = itemFor(model, name);
        return decode(await preflight.read(t.id, item.address, item.width), item.encoding);
      };
      if ((await read('ID')) !== t.id || (await read('Baud Rate')) !== model.bauds[String(t.baud)])
        throw Error('Swap source address/baud register mismatch');
      await validateConditions(model, itemFor(model, 'ID'), id, read);
    }
  } catch (e) {
    result.error = e.message;
    if (e.name === 'TransportClosureError') result.closureConfirmed = false;
  } finally {
    if (preflight)
      try {
        await preflight.close();
      } catch (e) {
        result.closureConfirmed = false;
        result.error = e.message;
      }
  }
  if (result.error || !result.closureConfirmed) return result;
  for (let index = 0; index < stages.length; index++) {
    const [t, id] = stages[index];
    const step = await configure(connect, { ...t, changes: { id } }, { signal });
    result.stages.push(step);
    result.closureConfirmed = step.closureConfirmed === true;
    if (step.outcome !== 'verified' || !result.closureConfirmed) {
      result.outcome = index === 0 && step.outcome === 'not_written' ? 'not_written' : 'uncertain';
      result.error = step.error ?? 'Swap transition could not be verified';
      result.recovery =
        'Inspect original, temporary and destination IDs read-only after confirmed closure; do not repeat or roll back writes';
      return result;
    }
    result.locations[index === 1 ? 'b' : 'a'] = { ...step.location };
  }
  let c;
  try {
    c = await connect(a.baud, 100, a.protocol);
    if (await c.probe(temporaryId)) throw Error('Temporary ID still responds after swap');
    for (const [t, id, index] of [
      [a, b.id, 0],
      [b, a.id, 1],
    ]) {
      const model = modelFor(t.model, t.firmware, t.catalogId, t.protocol),
        proof = await identify(c, id, t.protocol, { catalogId: model.catalogId });
      if (
        !proof?.identityComplete ||
        proof.modelNumber !== t.model ||
        proof.firmwareVersion !== t.firmware
      )
        throw Error('Final swap identity mismatch');
      const expected = { ...result.stages[index].snapshot, id };
      for (const [name, [address, width]] of Object.entries(readsFor(model)))
        if (
          expected[name] !== undefined &&
          decode(await c.read(id, address, width)) !== expected[name]
        )
          throw Error('Final swap continuity mismatch: ' + name);
    }
    result.outcome = 'verified';
  } catch (e) {
    result.outcome = 'uncertain';
    result.error = e.message;
    if (e.name === 'TransportClosureError') result.closureConfirmed = false;
  } finally {
    if (c)
      try {
        await c.close();
      } catch (e) {
        result.closureConfirmed = false;
        result.outcome = 'uncertain';
        result.error = e.message;
      }
  }
  return result;
}
