import { pythonExecutable } from './python-runtime.mjs';
// Operator-owned source contracts, validated offline before any device access.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const CUSTOM = (() => {
  const path = process.env.CYCLO_PRODUCTS_CUSTOM_TABLES;
  if (!path) return { models: [], itemModels: [] };
  const r = spawnSync(
    pythonExecutable(),
    [fileURLToPath(new URL('./custom_tables.py', import.meta.url)), path],
    { encoding: 'utf8', timeout: 5000, maxBuffer: 8 * 1024 * 1024 },
  );
  if (r.status !== 0)
    throw Error('Custom Control Table validation failed: ' + (r.stderr || r.error?.message));
  return JSON.parse(r.stdout);
})();
