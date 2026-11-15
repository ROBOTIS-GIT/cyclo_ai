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
  assert.match(mj.input, /Root-only files require explicit/);
  assert.match(mj.input, /Reject conflicting or ambiguous conventions and Isaac\/xyzw/);
  assert.match(lab.runtimeCheck, /Isaac Sim 6.2 \/ Isaac Lab 3.0 \/ Python 3.12/);
  assert.match(mj.artifacts, /does not imply ONNX/);
  for (const runtime of ['lab', 'mjlab']) {
    const ppo = mimicGuidance({ runtime, method: 'beyondmimic', stage: 'export' });
    assert.equal(ppo.task, 'Cyclo-Mimic-K1-Rev1-Dance1');
    assert.match(ppo.artifacts, /same-run/);
    assert.equal(ppo.capabilityDetected, false);
    assert.equal(ppo.status, 'guidance_only');
  }
});

test('local playback contracts remain simulator-specific and need no remote publication', () => {
  const lab = mimicGuidance({ runtime: 'lab', method: 'supermimic', stage: 'play' });
  const mj = mimicGuidance({ runtime: 'mjlab', method: 'supermimic', stage: 'play' });
  assert.match(lab.checkpoint, /--checkpoint /);
  assert.match(lab.checkpoint, /isaac-v3/);
  assert.match(lab.checkpoint, /legacy v2.*explicit PhysX\/GenCoord/);
  assert.match(lab.checkpoint, /fresh simulator\/replay\/RNG/);
  assert.match(lab.scope, /history 1/);
  assert.match(mj.checkpoint, /--checkpoint-dir/);
  for (const file of ['manifest.json', 'world_model.pt', 'actor.pt'])
    assert.ok(mj.checkpoint.includes(file));
  assert.match(mj.checkpoint, /no W&B upload\/sync/);
  assert.match(mj.checkpoint, /not optimizer\/replay resume/);
  for (const profile of [lab, mj]) {
    assert.match(profile.selection, /--algorithm beyondmimic\|supermimic/);
    assert.match(profile.checkpoint, /timestep.*decimation/);
    assert.equal(profile.capabilityDetected, false);
  }
});

test('shared core guidance preserves native choices and bounded feature acceptance', () => {
  for (const method of ['beyondmimic', 'supermimic']) {
    const mj = mimicGuidance({ runtime: 'mjlab', method });
    assert.match(mj.runtimeCheck, /Both algorithms use Python 3.12 \/ stable MJLab 1.6.1/);
    assert.match(mj.sharedCore, /10dd5dd3f02601caf1991790952a25db63a6fb99/);
    assert.equal(mj.revisionStatus, 'published');
    assert.equal(mj.reviewedRevision, '775c45cecde17ea0551e24de46cd3c62100e6149');
    assert.match(mj.acceptance, /Integrated Docker suite: 82 tests/);
    assert.match(mj.acceptance, /compiled history-mode acceptance.*not established/);
    assert.equal(mj.capabilityDetected, false);
  }
  const mj = mimicGuidance({ runtime: 'mjlab', method: 'supermimic' });
  assert.ok(mj.requiredPaths.includes('requirements.lock'));
  assert.ok(!mj.requiredPaths.includes('integrations/supermimic/uv.lock'));
  const lab = mimicGuidance({ runtime: 'lab', method: 'supermimic' });
  assert.match(lab.physics, /Newton\/MJWarp by default/);
  assert.match(lab.physics, /physics=isaacsim_physx/);
  assert.match(lab.scope, /GenCoord and MaxCoord/);
  assert.match(lab.physics, /num_substeps=1/);
  assert.equal(lab.reviewedRevision, '3cbd62592750ee0095df67f54399a0a320164e29');
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
  const guidanceTool = tools.tools.find((x) => x.name === 'cyclo_mimic');
  assert.equal(guidanceTool.annotations.readOnlyHint, true);
  assert.deepEqual(Object.keys(guidanceTool.inputSchema.properties).sort(), [
    'method',
    'runtime',
    'stage',
  ]);
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
