import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const pluginRoot = fileURLToPath(new URL('../../', import.meta.url));

export function pythonExecutable(env = process.env, root = pluginRoot) {
  if (env.CYCLO_PRODUCTS_PYTHON) return env.CYCLO_PRODUCTS_PYTHON;
  const local = join(
    root,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  return existsSync(local) ? local : process.platform === 'win32' ? 'python' : 'python3';
}
