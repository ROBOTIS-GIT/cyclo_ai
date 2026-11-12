import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, posix, win32 } from 'node:path';

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

// Windows environment keys are case-insensitive, but a copied JS object is not.
export function pythonEnvironment(python, env = process.env, platform = process.platform) {
  const result = { ...env };
  const path = platform === 'win32' ? win32 : posix;
  if (!path.isAbsolute(python)) return result;
  const keys = Object.keys(result)
    .filter((key) => (platform === 'win32' ? key.toLowerCase() === 'path' : key === 'PATH'))
    .sort();
  const previous = result[keys[0]] ?? '';
  for (const key of keys) delete result[key];
  result.PATH = path.dirname(python) + path.delimiter + previous;
  return result;
}
