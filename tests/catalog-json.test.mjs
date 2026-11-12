import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadJson } from '../modules/catalog-json.mjs';

test('catalog shards preserve nested values and reject changed or escaping bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cyclo catalog '));
  try {
    const data = '{"items":[1,"모터"]}';
    const ref = {
      $cycloJson: 'part.json',
      sha256: createHash('sha256').update(data).digest('hex'),
    };
    await writeFile(join(root, 'part.json'), data);
    await writeFile(join(root, 'index.json'), JSON.stringify({ models: [ref] }));
    assert.deepEqual(loadJson(join(root, 'index.json')), { models: [{ items: [1, '모터'] }] });
    await writeFile(join(root, 'part.json'), '{}');
    assert.throws(() => loadJson(join(root, 'index.json')), /hash/i);
    await writeFile(
      join(root, 'index.json'),
      JSON.stringify({ ...ref, $cycloJson: '../part.json' }),
    );
    assert.throws(() => loadJson(join(root, 'index.json')), /path/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
