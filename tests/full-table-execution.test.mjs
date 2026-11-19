import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS } from '../modules/dynamixel/registry.mjs';
import { ITEMS, writeItem, tableFor } from '../modules/dynamixel/table.mjs';
import { fullTableDevice } from './fixtures/full-table-device.mjs';
function validValue(item, f, m) {
  const r = item.write;
  if (item.name === 'ID') return f.request.id;
  if (item.name === 'Baud Rate') return m.bauds[String(f.request.baud)];
  if (item.name === 'Protocol Type') return f.request.protocol;
  if (item.name === 'Status Return Level') return 2;
  if (item.name === 'Hybrid Save') return 1;
  if (item.name.startsWith('External Port Mode ')) return 1;
  if (['Secondary ID', 'Secondary(Shadow) ID'].includes(item.name)) return 255;
  if (r.kind === 'indirect-map') return f.byName.get('Torque Enable').address;
  if (r.values) return r.values.includes(0) ? 0 : r.values[0];
  if (r.bounds) return r.bounds[0] <= 0 && r.bounds[1] >= 0 ? 0 : r.bounds[0];
  return 0;
}
for (const family of [...new Set(MODELS.map((m) => m.family))])
  test(`every resolved raw item in ${family} uses one execution engine on a byte-memory mock`, async () => {
    let count = 0,
      aliases = 0;
    for (const m of MODELS.filter((m) => m.family === family)) {
      const f = fullTableDevice(m);
      for (const item of tableFor(m)) {
        if (item.access === 'R' || item.write.status !== 'resolved') continue;
        const value = validValue(item, f, m),
          result = await writeItem(f.connect, f.request, item.key, value);
        assert.equal(result.outcome, 'verified', `${m.catalogId} ${item.key}: ${result.error}`);
        assert.equal(result.closureConfirmed, true);
        count++;
        if (item.write.kind === 'indirect-data') aliases++;
      }
    }
    assert.ok(count > 0);
    if (
      family !== 'ax_series' &&
      family !== 'dx_series' &&
      family !== 'ex_series' &&
      family !== 'rx_series'
    )
      assert.ok(aliases > 0);
  });
test('source incompleteness is restricted to explicit manufacturer information gaps, never generic parser placeholders', () => {
  const unresolved = ITEMS.models.flatMap((m) =>
    m.items
      .filter((i) => i.access !== 'R' && i.write.status !== 'resolved')
      .map((i) => ({
        model: m.catalogId,
        item: i.name,
        status: i.write.status,
        reason: i.write.reason,
      })),
  );
  assert.equal(unresolved.length, 2);
  assert.ok(
    unresolved.every((r) => r.item === 'Current' && r.status === 'manufacturer-unresolved'),
  );
});
