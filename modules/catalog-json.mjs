// Packaged catalog references are local, byte-verified data, never instructions.
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export function loadJson(path) {
  if (path instanceof URL) path = fileURLToPath(path);
  const base = dirname(realpathSync(path));
  const expand = (value) => {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    if (Object.hasOwn(value, '$cycloJson')) {
      const name = value.$cycloJson;
      if (
        typeof name !== 'string' ||
        isAbsolute(name) ||
        name.split('/').some((part) => !part || part === '..' || part === '.') ||
        name.includes('\\') ||
        !/^[a-f0-9]{64}$/.test(value.sha256)
      )
        throw Error('Invalid catalog reference path or hash');
      const target = realpathSync(join(base, name));
      if (relative(base, target).startsWith('..') || isAbsolute(relative(base, target)))
        throw Error('Catalog reference path escapes its directory');
      const bytes = readFileSync(target);
      if (createHash('sha256').update(bytes).digest('hex') !== value.sha256)
        throw Error('Catalog reference hash mismatch');
      return JSON.parse(bytes.toString('utf8'));
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, expand(child)]));
  };
  return expand(JSON.parse(readFileSync(path, 'utf8')));
}
