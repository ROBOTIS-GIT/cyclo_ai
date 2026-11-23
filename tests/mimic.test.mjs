import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createProductsServer } from '../modules/dynamixel/server.mjs';
import { mimicGuidance } from '../modules/knowledge/mimic.mjs';

const mj = (method, stage = 'prepare') => mimicGuidance({ runtime: 'mjlab', method, stage });

test('Lab and PPO contracts remain separate from the MJLab learner update', () => {
  const lab = mimicGuidance({ runtime: 'lab', method: 'supermimic', stage: 'play' });
  assert.equal(lab.reviewedRevision, '3cbd62592750ee0095df67f54399a0a320164e29');
  assert.match(lab.sharedCore, /10dd5dd3f02601caf1991790952a25db63a6fb99/);
  assert.match(lab.runtimeCheck, /Isaac Sim 6.2 \/ Isaac Lab 3.0 \/ Python 3.12/);
  assert.match(lab.physics, /Newton\/MJWarp by default/);
  assert.match(lab.physics, /physics=isaacsim_physx/);
  assert.match(lab.physics, /num_substeps=1/);
  assert.match(lab.scope, /GenCoord and MaxCoord.*history 1/);
  assert.match(lab.checkpoint, /isaac-v3/);
  assert.match(lab.checkpoint, /legacy v2.*explicit PhysX\/GenCoord/);
  assert.match(lab.checkpoint, /fresh simulator\/replay\/RNG/);
  for (const runtime of ['lab', 'mjlab']) {
    const ppo = mimicGuidance({ runtime, method: 'beyondmimic', stage: 'export' });
    assert.equal(
      ppo.task,
      runtime === 'lab' ? 'Cyclo-Mimic-K1-Rev1-Dance1' : 'Cyclo-BeyondMimic-K1-Rev1-Dance1',
    );
    assert.match(ppo.artifacts, /same-run/);
    assert.match(ppo.checkpoint, /logs\/rsl_rl/);
    assert.equal(ppo.capabilityDetected, false);
    assert.doesNotMatch(ppo.physics, /--representation|GenCoord|MaxCoord/);
    assert.match(ppo.sharedCore, /not a PPO prerequisite/);
    assert.equal(ppo.export, undefined);
  }
});

test('MJLab main profiles name current task families, revision choices and independent pins', () => {
  for (const method of ['beyondmimic', 'supermimic', 'blinkmimic']) {
    const profile = mj(method);
    assert.equal(profile.reviewedRevision, 'e17230e2770aeee4ecfebeb4ea84012475a25397');
    assert.equal(profile.revisionStatus, 'published');
    assert.match(profile.runtimeCheck, /Python 3.12 \/ MJLab 1.6.1/);
    if (method !== 'beyondmimic') {
      assert.match(profile.sharedCore, /a03f646d79bd92136b18095388b064e2ebe6dced/);
      assert.match(profile.sharedCore, /029f4092be88654807849478b3188cf708a3fdc8/);
    }
    assert.match(profile.acceptance, /does not establish simulator acceptance/);
    assert.match(profile.compatibility, /not legacy Cyclo-Mimic aliases/);
  }
  assert.deepEqual(mj('supermimic').tasks, [
    'Cyclo-SuperMimic-GenCoord-K1-Rev1-001',
    'Cyclo-SuperMimic-MaxCoord-K1-Rev1-001',
    'Cyclo-SuperMimic-GenCoord-K1-Rev2-001',
    'Cyclo-SuperMimic-MaxCoord-K1-Rev2-001',
  ]);
  assert.deepEqual(mj('blinkmimic').tasks, [
    'Cyclo-BlinkMimic-K1-Rev1-001',
    'Cyclo-BlinkMimic-K1-Rev2-001',
  ]);
  assert.ok(mj('supermimic').requiredPaths.includes('scripts/reinforcement_learning/cli.py'));
  assert.ok(!mj('supermimic').requiredPaths.includes('source/learning/dispatch.py'));
});

test('motion adapters preserve revision-specific original data and distinct CLI inputs', () => {
  const supermimic = mj('supermimic');
  const blink = mj('blinkmimic');
  assert.match(supermimic.input, /--motion-file.*comma list.*internal adapter/);
  assert.match(supermimic.input, /mujoco\/wxyz\/world\/link_origin/);
  assert.match(supermimic.input, /Reject conflicting or ambiguous conventions and Isaac\/xyzw/);
  assert.match(supermimic.scope, /proprio\/history_length=10/);
  assert.match(blink.input, /source.tasks.blinkmimic.prepare/);
  assert.match(blink.input, /--motion-dir.*not --motion-file/);
  assert.match(blink.input, /source hashes\/bytes and 50 Hz/);
  assert.match(blink.input, /No resampling or re-differentiation/);
});

test('resume and playback distinguish latest state, numbered models and legacy split bundles', () => {
  const supermimic = mj('supermimic', 'play');
  const blink = mj('blinkmimic', 'play');
  assert.match(supermimic.checkpoint, /cyclo.supermimic.checkpoint.v1/);
  assert.match(supermimic.checkpoint, /prefers last.pt/);
  for (const file of ['manifest.json', 'actor.pt', 'world_model.pt'])
    assert.ok(supermimic.checkpoint.includes(file));
  assert.match(supermimic.checkpoint, /split bundles remain inference-only/);
  assert.match(supermimic.resume, /split inference bundles cannot resume/);
  assert.match(supermimic.checkpoint, /no W&B upload\/sync/);
  assert.match(supermimic.playback, /without restoring saved environment overrides or validating/);
  assert.match(supermimic.playback, /source task, not the selected playback environment/);
  assert.match(supermimic.playback, /--export-policy False/);
  assert.match(supermimic.playback, /At most one/);
  assert.match(supermimic.resume, /omission selects current task defaults/);
  assert.match(blink.checkpoint, /last.pt is not accepted by the playback selector/);
  assert.match(blink.checkpoint, /highest numbered snapshot/);
  for (const profile of [supermimic, blink]) {
    assert.match(
      profile.resume,
      /--agent.resume True --agent.load-run RUN --agent.load-checkpoint last.pt/,
    );
    assert.match(profile.resume, /total target/);
    assert.match(profile.resume, /--world-model-checkpoint/);
    assert.match(profile.resume, /optimizers restart|optimizer-reset/);
    assert.match(profile.resume, /replay/);
    assert.equal(profile.status, 'guidance_only');
  }
});

test('MJLab export guidance preserves method-specific layouts and hardware review boundary', () => {
  const supermimic = mj('supermimic', 'export');
  const blink = mj('blinkmimic', 'export');
  assert.match(supermimic.export, /NEW_DIR\/policy.onnx/);
  assert.match(supermimic.export, /term-major/);
  assert.match(supermimic.export, /rep_state requires history 1/);
  assert.match(blink.export, /NEW_DIR\/exported\/policy.onnx/);
  assert.match(blink.export, /frame-major/);
  assert.match(blink.export, /saved pi \(not pi_live\)/);
  assert.match(blink.export, /without enforcing args.robot/);
  for (const method of ['supermimic', 'blinkmimic']) {
    const profile = mj(method, 'sim2real');
    assert.match(profile.artifacts, /Sim2Real guidance is asset review only/);
    assert.match(profile.artifacts, /no hardware validation/);
    assert.match(profile.artifacts, /velocity encoder uses velocity commands, not a motion CSV/);
    assert.match(profile.export, /params\/sim2real.yaml/);
    assert.equal(profile.capabilityDetected, false);
  }
});

test('unsupported runtime/method or stage never falls back to PPO', () => {
  for (const stage of ['export', 'sim2real'])
    assert.throws(
      () => mimicGuidance({ runtime: 'lab', method: 'supermimic', stage }),
      /no validated K1 export\/controller contract/,
    );
  for (const args of [
    { runtime: 'lab', method: 'blinkmimic' },
    { runtime: 'lab', method: 'unknown' },
    { runtime: 'unknown', method: 'beyondmimic' },
    { runtime: '__proto__', method: 'supermimic' },
    { runtime: 'lab', method: '__proto__' },
    { runtime: 'mjlab', method: 'blinkmimic', stage: 'deploy' },
  ])
    assert.throws(() => mimicGuidance(args));
});

test('packaged examples include the same reviewed tasks and distinct export selectors', async () => {
  const docs = await readFile(
    new URL('../skills/ai-sapiens-video-mimic/references/methods.md', import.meta.url),
    'utf8',
  );
  for (const method of ['supermimic', 'blinkmimic']) {
    const profile = mj(method);
    assert.ok(docs.includes(profile.reviewedRevision));
    for (const task of profile.tasks) assert.ok(docs.includes(task));
    assert.ok(docs.includes(`export.py --algorithm ${method}`));
  }
  assert.match(docs, /does not accept `last.pt`/);
  assert.match(docs, /Lab SuperMimic export\/Sim2Real guidance still stops/);
  const commands = [...docs.matchAll(/```bash\n([\s\S]*?)```/g)].flatMap((m) =>
    m[1].replaceAll('\\\n', ' ').split('\n'),
  );
  const resume = commands.find(
    (line) => line.includes('--algorithm supermimic') && line.includes('--agent.resume'),
  );
  assert.ok(resume?.includes('--motion-file /data/k1_rev2_motion.npz'));
  const headless = commands.find(
    (line) => line.includes('--algorithm supermimic') && line.includes('--viewer headless'),
  );
  assert.ok(headless?.includes('--export-policy False'));
  assert.doesNotMatch(headless, /--no-export-policy/);
});

test('MCP guidance covers all supported pairs without device access or new job inputs', async (t) => {
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
  const { tools } = await c.listTools();
  const guidanceTool = tools.find((x) => x.name === 'cyclo_mimic');
  assert.equal(guidanceTool.annotations.readOnlyHint, true);
  assert.deepEqual(Object.keys(guidanceTool.inputSchema.properties).sort(), [
    'method',
    'runtime',
    'stage',
  ]);
  for (const runtime of ['lab', 'mjlab']) {
    const methods =
      runtime === 'lab'
        ? ['beyondmimic', 'supermimic']
        : ['beyondmimic', 'supermimic', 'blinkmimic'];
    for (const method of methods) {
      const result = await c.callTool({ name: 'cyclo_mimic', arguments: { runtime, method } });
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.capabilityDetected, false);
      assert.ok(result.structuredContent.requiredPaths.length);
    }
  }
  for (const method of ['supermimic', 'blinkmimic']) {
    const result = await c.callTool({
      name: 'cyclo_mimic',
      arguments: { runtime: 'mjlab', method, stage: 'export' },
    });
    assert.equal(result.isError, undefined);
    assert.match(result.structuredContent.export, /policy.onnx/);
  }
  for (const args of [
    { runtime: 'lab', method: 'blinkmimic' },
    { runtime: 'lab', method: 'supermimic', stage: 'sim2real' },
    { runtime: 'mjlab', method: 'blinkmimic', backend: 'physx' },
  ]) {
    const blocked = await c.callTool({ name: 'cyclo_mimic', arguments: args });
    assert.equal(blocked.isError, true);
  }
  assert.equal(deviceCalls, 0);
});
