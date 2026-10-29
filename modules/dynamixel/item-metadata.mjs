import { CUSTOM } from './custom.mjs';
// One immutable canonical item catalog shared by all product execution paths.
import { readFileSync } from 'node:fs';
export const ITEMS = JSON.parse(
  readFileSync(new URL('../../references/control-items.json', import.meta.url), 'utf8'),
);
ITEMS.models.push(...CUSTOM.itemModels);
const models = new Map(ITEMS.models.map((m) => [m.catalogId, m]));
export const itemsFor = (catalogId) => models.get(catalogId)?.items ?? [];
export function descriptor(catalogId, key) {
  const items = itemsFor(catalogId),
    matches = items.filter((i) => i.key === key || i.name === key);
  return matches.length === 1 ? matches[0] : undefined;
}
