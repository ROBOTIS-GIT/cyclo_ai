import { CUSTOM } from './custom.mjs';
// One immutable canonical item catalog shared by all product execution paths.
import { loadJson } from '../catalog-json.mjs';
export const ITEMS = loadJson(new URL('../../references/control-items.json', import.meta.url));
ITEMS.models.push(...CUSTOM.itemModels);
const models = new Map(ITEMS.models.map((m) => [m.catalogId, m]));
export const itemsFor = (catalogId) => models.get(catalogId)?.items ?? [];
export function descriptor(catalogId, key) {
  const items = itemsFor(catalogId),
    matches = items.filter((i) => i.key === key || i.name === key);
  return matches.length === 1 ? matches[0] : undefined;
}
