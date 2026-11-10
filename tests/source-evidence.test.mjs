import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { codeIndex, readCode, profileFor } from '../modules/knowledge/source.mjs';
import { createProductsServer } from '../modules/dynamixel/server.mjs';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
const index = JSON.parse(
  await readFile(new URL('../references/dhi-sources.json', import.meta.url)),
);
const body =
  '// Source fixture: never execute\nvoid Example::configure() {\n  run_untrusted_text();\n}\n';
const bytes = Buffer.from(body);
const fixture = {
  checkedOn: '2026-10-26',
  indexKind: 'lexical',
  packages: {
    demo: {
      repository: 'ROBOTIS-GIT/example',
      profiles: {
        humble: {
          revision: 'a'.repeat(40),
          files: {
            'src/test.cpp': {
              blobSha: createHash('sha1')
                .update(`blob ${bytes.length}\0`)
                .update(bytes)
                .digest('hex'),
              definitions: [],
              references: [],
            },
          },
        },
      },
    },
  },
};
test('all indexed profiles retain exact official source and interface-generation distinction', () => {
  const d = index.packages.dynamixel_hardware_interface.profiles;
  assert.equal(d.main.initArgument, 'HardwareComponentInterfaceParams');
  assert.equal(d.humble.initArgument, 'HardwareInfo');
  assert.equal(
    d.main.files['src/dynamixel_hardware_interface.cpp'].blobSha,
    d.jazzy.files['src/dynamixel_hardware_interface.cpp'].blobSha,
  );
  assert.deepEqual(d.main.lifecycleOverrides, ['on_activate', 'on_deactivate', 'on_init']);
  assert.throws(
    () => profileFor(index, 'dynamixel_hardware_interface', 'rolling'),
    /Unknown source/,
  );
});
test('index locates lower-level callers, models, services and multiple source revisions', () => {
  for (const query of [
    'DynamixelDisable',
    'WriteItemBuf',
    'SelectModelFileByFirmwareVersion',
    'xm430',
    'SetBool',
  ]) {
    const r = codeIndex(index, {
      package: 'dynamixel_hardware_interface',
      profile: 'humble',
      query,
    });
    assert.ok(r.total > 0, query);
    assert.ok(
      r.matches.every(
        (m) => m.revision === index.packages.dynamixel_hardware_interface.profiles.humble.revision,
      ),
    );
  }
  assert.throws(() => codeIndex(index, { package: 'unknown' }), /Unknown/);
  assert.throws(
    () => codeIndex(index, { package: 'dynamixel_hardware_interface', profile: 'master' }),
    /Profile/,
  );
  assert.throws(() => profileFor(index, '__proto__', 'main'), /not indexed/);
});
test('bounded source reader verifies bytes and citations without treating code as instructions', async () => {
  let calls = 0;
  const r = await readCode(
    fixture,
    { package: 'demo', profile: 'humble', path: 'src/test.cpp', startLine: 2, lineCount: 2 },
    {
      fetchSource: async (url, opts) => {
        calls++;
        assert.equal(opts.redirect, 'error');
        assert.match(url, /\/a{40}\//);
        return new Response(body);
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(r.lines[0].line, 2);
  assert.equal(r.blobVerified, true);
  assert.equal(r.lines.length, 2);
  assert.match(r.sourceTrust, /not instructions/);
});
test('unknown paths/revisions fail before fetch; hash, retrieval and size failures cannot fall back', async () => {
  let calls = 0;
  const bad = async () => {
    calls++;
    return new Response('wrong');
  };
  const a = { package: 'demo', profile: 'humble', path: 'src/test.cpp' };
  await assert.rejects(
    readCode(fixture, { ...a, profile: 'jazzy' }, { fetchSource: bad }),
    /Unknown/,
  );
  await assert.rejects(
    readCode(fixture, { ...a, path: '../secret' }, { fetchSource: bad }),
    /outside/,
  );
  await assert.rejects(
    readCode(fixture, { ...a, path: '__proto__' }, { fetchSource: bad }),
    /outside/,
  );
  assert.equal(calls, 0);
  await assert.rejects(readCode(fixture, a, { fetchSource: bad }), /hash mismatch/);
  await assert.rejects(
    readCode(fixture, a, { fetchSource: async () => new Response('', { status: 404 }) }),
    /unavailable/,
  );
  await assert.rejects(
    readCode(fixture, a, { fetchSource: async () => new Response('x'.repeat(1024 * 1024 + 1)) }),
    /bounded/,
  );
});
test('read-only code MCP remains available offline and never constructs device provider', async (t) => {
  let calls = 0;
  const server = await createProductsServer(
    { CYCLO_OFFLINE: '1' },
    {
      provider: {
        connect() {
          calls++;
          throw Error('NO HARDWARE');
        },
        ports() {
          calls++;
          throw Error('NO PORTS');
        },
      },
    },
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const c = new Client({ name: 'code-evidence-test', version: '0.10.0' });
  await c.connect(a);
  t.after(() => c.close());
  const r = await c.callTool({
    name: 'robotis_code',
    arguments: {
      action: 'index',
      package: 'dynamixel_hardware_interface',
      profile: 'jazzy',
      query: 'start',
    },
  });
  assert.ok(r.structuredContent.total > 0);
  assert.equal(calls, 0);
  const missing = await c.callTool({
    name: 'robotis_code',
    arguments: { action: 'read', package: 'dynamixel_hardware_interface', path: 'package.xml' },
  });
  assert.equal(missing.isError, true);
  assert.equal(calls, 0);
});
