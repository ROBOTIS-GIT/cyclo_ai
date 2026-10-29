// Declarative raw-register constraints, shared in canonical JSON with Python.
import { encode } from './registry.mjs';
export function scalar(rule, item, value, firmware, protocol) {
  if (!Number.isSafeInteger(value))
    throw Error('Exact raw integer required; no unit conversion is inferred');
  if (rule.status !== 'resolved') throw Error(`${rule.status}: ${rule.reason}`);
  encode(value, item.width, rule.encoding ?? 'unsigned');
  if (firmware < (rule.minimumFirmware ?? 0))
    throw Error('Observed firmware does not support this item');
  if (rule.protocols && !rule.protocols.includes(protocol))
    throw Error('Item is unavailable with the selected packet protocol');
  if (rule.values && !rule.values.includes(value))
    throw Error('Value is not a documented enum/sentinel');
  if (rule.bounds && (value < rule.bounds[0] || value > rule.bounds[1]))
    throw Error('Value outside documented raw range');
  if (rule.allowedMask !== undefined && (BigInt(value) & ~BigInt(rule.allowedMask)) !== 0n)
    throw Error('Reserved control bits must remain zero');
  for (const [bit, since] of Object.entries(rule.bitMinimumFirmware ?? {}))
    if ((BigInt(value) & BigInt(bit)) !== 0n && firmware < since)
      throw Error(`Requested control bit requires firmware ${since}`);
}
export async function live(
  rule,
  value,
  read,
  { firmware, protocol, hasItem = () => true, peerRead } = {},
) {
  const observed = {},
    effects = [];
  const get = async (name) =>
    Object.hasOwn(observed, name) ? observed[name] : (observed[name] = await read(name));
  const when = async (c) => {
    if (c.all) {
      for (const part of c.all) if (!(await when(part))) return false;
      return true;
    }
    if (c.any) {
      for (const part of c.any) if (await when(part)) return true;
      return false;
    }
    if (c.firmwareAtLeast !== undefined && firmware < c.firmwareAtLeast) return false;
    if (c.protocols && !c.protocols.includes(protocol)) return false;
    if (c.item) {
      if (!hasItem(c.item)) return false;
      let actual = await get(c.item);
      if (c.mask !== undefined) actual = Number(BigInt(actual) & BigInt(c.mask));
      if (c.equals !== undefined && actual !== c.equals) return false;
      if (c.notEquals !== undefined && actual === c.notEquals) return false;
      if (c.in && !c.in.includes(actual)) return false;
    }
    return true;
  };
  const expression = async (e) =>
    e.constant !== undefined ? e.constant : (await get(e.item)) * (e.sign ?? 1);
  const range = async (r) => {
    if (r.bounds && (value < r.bounds[0] || value > r.bounds[1]))
      throw Error('Value outside documented mode-dependent raw bounds');
    if (r.rangeExpressions) {
      const lo = await expression(r.rangeExpressions.lower),
        hi = await expression(r.rangeExpressions.upper);
      if (value < lo || value > hi) throw Error('Value exceeds observed documented bounds');
    }
    if (firmware < (r.minimumFirmware ?? 0))
      throw Error('Configured feature requires newer firmware');
    if (r.effect) effects.push(r.effect);
  };
  if (rule.requiresTorqueOff) {
    if ((await get('Torque Enable')) !== 0)
      throw Error(
        'Documented item precondition requires torque already off; no implicit torque change',
      );
    if (peerRead) await peerRead('Torque Enable', 0);
  }
  if (rule.requiresLockZero && hasItem('Lock') && (await get('Lock')) !== 0)
    throw Error('EEPROM is locked until the documented power cycle; no implicit unlock');
  if (rule.requiresMode) {
    const mode = await get('Operating Mode');
    if (!rule.modes.includes(mode)) throw Error('Item unsupported in observed Operating Mode');
    if (rule.modeBounds) {
      const r = rule.modeBounds[String(mode)];
      await range(
        r.minItem
          ? { rangeExpressions: { lower: { item: r.minItem }, upper: { item: r.maxItem } } }
          : { bounds: [r.min, r.max] },
      );
    }
  }
  if (rule.dynamicLimit && Math.abs(value) > (await get(rule.dynamicLimit)))
    throw Error('Goal exceeds observed dynamic limit');
  await range(rule);
  if (rule.cases) {
    for (const c of rule.cases)
      if (await when(c.when)) {
        await range(c);
        break;
      }
  }
  for (const [name, values] of Object.entries(rule.requiresItems ?? {}))
    if (!values.includes(await get(name)))
      throw Error('Documented item access condition is not satisfied');
  for (const [name, values] of Object.entries(rule.forbiddenStates ?? {}))
    if (values.includes(await get(name)))
      throw Error('Controller state currently makes this item unavailable');
  for (const c of rule.conditionalForbiddenRawStates ?? [])
    if (
      firmware >= (c.minimumFirmware ?? 0) &&
      hasItem(c.item) &&
      c.values.includes(await get(c.item))
    )
      throw Error(
        'Documented device error makes this item read-only; explicitly clear that condition first',
      );
  for (const [name, values] of Object.entries(rule.forbiddenRawStates ?? {}))
    if (values.includes(await get(name))) throw Error('Documented error makes this item read-only');
  if (
    rule.latch &&
    (await get(rule.latch.item)) === rule.latch.lockedValue &&
    value === rule.latch.cannotWrite
  )
    throw Error('Documented latch cannot be cleared without a power cycle');
  return { observed, effects };
}
