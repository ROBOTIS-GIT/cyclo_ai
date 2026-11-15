import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createProductsServer } from '../modules/dynamixel/server.mjs';
import { mimicGuidance } from '../modules/knowledge/mimic.mjs';

test('method selection preserves distinct runtime and artifact contracts', () => {
  const lab = mimicGuidance({ runtime: 'lab', method: 'supermimic', stage: 'play' });
  const mj = mimicGuidance({ runtime: 'mjlab', method: 'supermimic', stage: 'play' });
  assert.notEqual(lab.checkpoint, mj.checkpoint);
  assert.match(lab.input, /directly/);
  assert.match(mj.input, /internal adapter/);
  assert.match(mj.input, /ambiguous metadata must fail/);
  assert.match(mj.artifacts, /does not imply ONNX/);
  for (const runtime of ['lab', 'mjlab']) {
    const ppo = mimicGuidance({ runtime, method: 'beyondmimic', stage: 'export' });
    assert.equal(ppo.task, 'Cyclo-Mimic-K1-Rev1-Dance1');
    assert.match(ppo.artifacts, /same-run/);
    assert.equal(ppo.capabilityDetected, false);
    assert.equal(ppo.status, 'guidance_only');
  }
});

test('unsupported stage or unknown method never falls back to PPO', () => {
  for (const runtime of ['lab', 'mjlab'])
    for (const stage of ['export', 'sim2real'])
      assert.throws(
        () => mimicGuidance({ runtime, method: 'supermimic', stage }),
        /no validated K1 export\/controller contract/,
      );
  for (const args of [
    { runtime: 'lab', method: 'unknown' },
    { runtime: 'unknown', method: 'beyondmimic' },
    { runtime: '__proto__', method: 'supermimic' },
    { runtime: 'lab', method: '__proto__' },
    { runtime: 'lab', method: 'supermimic', stage: 'deploy' },
  ])
    assert.throws(() => mimicGuidance(args));
});

test('MCP selection is device-free, branch-aware and refuses unsupported deployment', async (t) => {
  let deviceCalls = 0;
  const server = await createProductsServer(
    { CYCLO_OFFLINE: '1' },
    {
      provider: {
        ports() {
          deviceCalls++;
          throw Error('No devices');
        },
        connect() {
          deviceCalls++;
          throw Error('No devices');
        },
      },
    },
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const c = new Client({ name: 'mimic-test', version: '1' });
  await c.connect(a);
  t.after(() => c.close());
  const tools = await c.listTools();
  assert.equal(tools.tools.find((x) => x.name === 'cyclo_mimic').annotations.readOnlyHint, true);
  for (const runtime of ['lab', 'mjlab'])
    for (const method of ['beyondmimic', 'supermimic']) {
      const result = await c.callTool({ name: 'cyclo_mimic', arguments: { runtime, method } });
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.capabilityDetected, false);
      assert.ok(result.structuredContent.requiredPaths.length);
      assert.match(result.structuredContent.next, /Missing or changed interfaces/);
    }
  const blocked = await c.callTool({
    name: 'cyclo_mimic',
    arguments: { runtime: 'lab', method: 'supermimic', stage: 'sim2real' },
  });
  assert.equal(blocked.isError, true);
  assert.match(blocked.structuredContent.error, /Preserve the checkpoint/);
  assert.equal(deviceCalls, 0);
});
