// Packaged guidance, never a detected installation or execution capability.
const profiles = {
  lab: {
    beyondmimic: {
      learner: 'BeyondMimic whole_body_tracking-based PPO',
      requiredPaths: ['scripts/reinforcement_learning/rsl_rl/train.py'],
      task: 'Cyclo-Mimic-K1-Rev1-Dance1',
      input: 'Cyclo motion NPZ; matching deployment motion CSV',
      checkpoint: 'logs/rsl_rl/<experiment>/<run>/model_*.pt',
    },
    supermimic: {
      learner: 'SuperMimic differentiable world model and imagined-rollout policy learner',
      requiredPaths: [
        'scripts/reinforcement_learning/train.py',
        'scripts/reinforcement_learning/play.py',
        'scripts/reinforcement_learning/supermimic/train.py',
        'third_party/supermimic/src/supermimic/models.py',
        'requirements/supermimic.txt',
      ],
      task: 'Cyclo-SuperMimic-K1-Rev1-Dance1',
      input:
        'Existing 50 Hz Cyclo NPZ directly; common train/play selector validates unique joint/body names and explicit quaternion_order/quat_order before native articulation reorder and xyzw bridge conversion. SuperMimic validates all frames/bodies against K1 FK and source-defined COM profiles; real arrays must remain finite after float32 conversion. Missing producer/backend labels remain unspecified. Direct legacy PPO launchers retain historical fallback behavior.',
      checkpoint:
        'Use --checkpoint logs/supermimic/<run>/model_<iteration>.pt; strict cyclo-supermimic-isaac-v3 physical/task/motion/representation contract; legacy v2 loading only for strictly compatible explicit PhysX/GenCoord, including exact timestep and decimation. Local playback; continuation restores learned/optimizer state into fresh simulator/replay/RNG, not exact trajectory resume.',
      scope:
        'Inherited Newton/MJWarp or explicit PhysX; GenCoord and MaxCoord K1, privileged rep_state, history 1, one clip/encoder, fixed dynamics and zero context. No proprio/history deployment, motion-to-velocity latent BC, official return sampling or multi-task/multi-clip integration.',
    },
  },
  mjlab: {
    beyondmimic: {
      learner: 'BeyondMimic whole_body_tracking-based PPO',
      requiredPaths: ['scripts/reinforcement_learning/train.py', 'source/tasks/beyondmimic'],
      task: 'Cyclo-BeyondMimic-K1-Rev1-Dance1',
      input: 'Cyclo body-state motion NPZ; matching deployment motion CSV',
      checkpoint: 'logs/rsl_rl/<experiment>/<run>/model_*.pt',
    },
    supermimic: {
      learner: 'SuperMimic differentiable world model and imagined-rollout policy learner',
      requiredPaths: [
        'scripts/reinforcement_learning/cli.py',
        'scripts/reinforcement_learning/export.py',
        'source/tasks/supermimic/config',
        'source/tasks/supermimic/training/checkpoint/archive.py',
        'source/tasks/supermimic/reference/motion.py',
        'requirements.lock',
        'third_party/supermimic/src/supermimic/runners/exporter.py',
      ],
      task: 'Cyclo-SuperMimic-GenCoord-K1-Rev1-001',
      tasks: [
        'Cyclo-SuperMimic-GenCoord-K1-Rev1-001',
        'Cyclo-SuperMimic-MaxCoord-K1-Rev1-001',
        'Cyclo-SuperMimic-GenCoord-K1-Rev2-001',
        'Cyclo-SuperMimic-MaxCoord-K1-Rev2-001',
      ],
      input:
        'Task defaults select revision-matched Dance1 and Dance2. Optional --motion-file accepts a file, comma list or quoted glob through the internal adapter. Validate named 50 Hz K1 data against the selected robot FK and supported COM profiles; root-only data requires mujoco/wxyz/world/link_origin metadata. Reject conflicting or ambiguous conventions and Isaac/xyzw inputs; preserve original bytes and rate.',
      scope:
        'Native MuJoCo GenCoord/MaxCoord, K1 Rev.1/Rev.2. Fresh training defaults to proprio/history_length=10; saved settings govern reload. Do not infer hardware readiness or a complete training acceptance matrix from registration or export tests.',
      checkpoint:
        'logs/supermimic/<task>/<run>/last.pt is a combined cyclo.supermimic.checkpoint.v1 archive with models, available optimizer state and sampler state. checkpoints/model_<step>.pt omits optimizers. Play accepts --checkpoint FILE or --checkpoint-dir RUN (prefers last.pt); legacy manifest.json/actor.pt/world_model.pt split bundles remain inference-only. Validate representation, robot/actions and exact timestep/decimation. Local playback needs no W&B upload/sync.',
      resume:
        'Train with --agent.resume True --agent.load-run RUN --agent.load-checkpoint last.pt; --runner.max-iterations is the total target, not additional updates. Numbered combined snapshots allow model-only resume with an optimizer-reset warning; split inference bundles cannot resume. Simulator and replay restart. --world-model-checkpoint initializes only dynamics in a fresh run and is mutually exclusive with resume.',
      export:
        'scripts/reinforcement_learning/export.py --algorithm supermimic TASK --checkpoint FILE --output-dir NEW_DIR [--encoder motion|velocity] emits NEW_DIR/policy.onnx, metadata.json and license notices. Play exports active encoders by default under exported/<checkpoint-stem>/ (legacy split bundles: exported/). Training writes params/sim2real.yaml and params/velocity/sim2real.yaml for active encoders. Graph has obs/actions, frozen normalization and term-major history plus external goals; no motion table or world model. rep_state requires history 1 and remains privileged; never convert it into proprio by relabeling.',
    },
    blinkmimic: {
      learner:
        'BlinkMimic released world-model and imagined-rollout policy recipe in an isolated worker',
      requiredPaths: [
        'scripts/reinforcement_learning/cli.py',
        'scripts/reinforcement_learning/export.py',
        'source/tasks/blinkmimic/cli.py',
        'source/tasks/blinkmimic/prepare.py',
        'source/tasks/blinkmimic/training/checkpoint/resume.py',
        'third_party/blinkmimic/scripts/presets.sh',
        'third_party/blinkmimic/src/blinkmimic/networks.py',
      ],
      task: 'Cyclo-BlinkMimic-K1-Rev1-001',
      tasks: ['Cyclo-BlinkMimic-K1-Rev1-001', 'Cyclo-BlinkMimic-K1-Rev2-001'],
      input:
        'Task defaults prepare revision-matched Dance1/Dance2 automatically. Custom NPZ inputs use python -m source.tasks.blinkmimic.prepare --task TASK INPUTS --output NEW_LIBRARY, then --motion-dir NEW_LIBRARY (not --motion-file). The exact-state manifest preserves source hashes/bytes and 50 Hz; unique clip basenames, selected-robot names/FK and mujoco/wxyz/world/link_origin states are required. No resampling or re-differentiation in this adapter.',
      scope:
        'K1 Rev.1/Rev.2 registry; native MuJoCo with the pinned released recipe in a separate process. --execution official is default; compiled_no_torch_graphs is an explicit systems alternative, not a reduced learner or automatic fallback. Do not transfer upstream G1 speed/convergence claims to K1.',
      checkpoint:
        'logs/blinkmimic/<task>/<run>/last.pt retains full training state; numbered model_<iteration>.pt snapshots omit optimizers. Play selects --checkpoint model_N.pt or the highest numbered snapshot in --checkpoint-dir RUN; last.pt is not accepted by the playback selector. Preserve args.json, run-record.json and the recorded motion manifest. Local playback needs no remote synchronization.',
      resume:
        'Train with --agent.resume True --agent.load-run RUN --agent.load-checkpoint last.pt; --iterations is the total target. Restore saved models/available optimizers and compatible sampler state into fresh simulation/replay. Numbered model-only resume warns that optimizers restart. --world-model-checkpoint seeds only dynamics for fresh training; robot/configuration checks still apply.',
      export:
        'scripts/reinforcement_learning/export.py --algorithm blinkmimic TASK --checkpoint model_N.pt --output-dir NEW_DIR emits NEW_DIR/exported/policy.onnx, metadata.json and license notices. Training writes params/sim2real.yaml. Viser playback refreshes the run export; headless evaluation is not the GUI export path. The FP32 graph uses saved pi (not pi_live), observations/actions, frame-major history then external future goals, frozen normalization and reference skip when configured. Do not add the reference action twice; FP32 equivalence is not bitwise BF16 equivalence. Export uses the selected task robot without enforcing args.robot; independently verify revision/run provenance.',
    },
  },
};
export function mimicGuidance({ runtime, method, stage = 'prepare' }) {
  if (!Object.hasOwn(profiles, runtime) || !Object.hasOwn(profiles[runtime], method))
    throw Error(
      'Unsupported runtime/method pair. Lab supports beyondmimic or supermimic; MJLab also supports blinkmimic. No PPO fallback.',
    );
  if (!['prepare', 'train', 'play', 'export', 'sim2real'].includes(stage))
    throw Error('Unknown Mimic stage');
  if (runtime === 'lab' && method === 'supermimic' && ['export', 'sim2real'].includes(stage))
    throw Error(
      'SuperMimic has no validated K1 export/controller contract. Preserve the checkpoint; do not rename it to policy.onnx or reuse PPO sim2real.yaml. Verify a method-specific exporter and controller before deployment.',
    );
  return {
    ...profiles[runtime][method],
    runtime,
    method,
    stage,
    selection:
      runtime === 'lab'
        ? 'Lab exposes scripts/reinforcement_learning/train.py and play.py with optional --algorithm beyondmimic|supermimic or recognized task-family inference, using --task. Historical aliases/direct launchers remain; current Lab 6.2 PPO train/play share task IDs.'
        : 'MJLab common train.py/play.py take a positional task and optional --algorithm beyondmimic|supermimic|blinkmimic; explicit family/task mismatches fail. Select Rev.1/Rev.2 by exact registered task ID, never by renaming checkpoints.',
    reviewedRevision:
      runtime === 'lab'
        ? '3cbd62592750ee0095df67f54399a0a320164e29'
        : 'e17230e2770aeee4ecfebeb4ea84012475a25397',
    revisionStatus: 'published',
    acceptance:
      runtime === 'lab'
        ? 'Four bounded backend/representation train/continue/play cells and both BeyondMimic backend regressions reported passed. Lab learner compilation and deployable proprio/history remain unvalidated; no convergence or robot claim.'
        : 'MJLab 1.1.0 main source, registry, CLI, Docker and checkpoint/export tests inspected. This plugin performs device-free guidance tests only; it does not establish simulator acceptance, convergence, historical checkpoint compatibility or hardware readiness for this revision.',
    sharedCore:
      runtime === 'lab'
        ? 'ROBOTIS-GIT/supermimic submodule third_party/supermimic at 10dd5dd3f02601caf1991790952a25db63a6fb99, derived from official HybridRobotics abc124c1. Initialize the gitlink and use consumer dependencies.'
        : 'MJLab gitlinks: third_party/supermimic a03f646d79bd92136b18095388b064e2ebe6dced (official HybridRobotics lineage 698ea39b); third_party/blinkmimic 029f4092be88654807849478b3188cf708a3fdc8 (released BlinkMimic lineage d264658d); third_party/ai_sapiens 0f1ca21e657c27aacd8a84d9ad3f1c7284c1aa03. Initialize recursively and use the consumer lock, not upstream standalone research environments.',
    status: 'guidance_only',
    capabilityDetected: false,
    physics:
      runtime === 'lab'
        ? 'Isaac Lab native; inherited Newton/MJWarp by default or explicit physics=isaacsim_physx. Select --representation gencoord|maxcoord independently. Conflicting physics flags fail; Newton solver num_substeps=1 is distinct from policy decimation; no silent PhysX fallback.'
        : 'Native MuJoCo/stable MJLab; SuperMimic chooses GenCoord/MaxCoord by task ID; BlinkMimic uses its own released recipe. Keep Lab and MJLab native environments and core pins separate.',
    runtimeCheck:
      runtime === 'lab'
        ? 'Verify native feature checkout pins: Isaac Sim 6.2 / Isaac Lab 3.0 / Python 3.12 for the reviewed SuperMimic port; other branches may differ. Do not use an mjlab sidecar as Lab support.'
        : 'MJLab 1.1.0: Python 3.12 / MJLab 1.6.1, MuJoCo/MuJoCo-Warp 3.11.0, Warp 1.14.0, Torch 2.14.0. Docker installs requirements.lock then --no-deps -e third_party/supermimic -e .; BlinkMimic is selected in an isolated worker from its submodule. Inspect mounts/resources before authorized build/start; an old image is not upgraded by git pull.',
    next: 'Record git revision and dirty state; inspect required paths, registrations and actual CLI help in the selected environment. Missing or changed interfaces mean stop and inspect branch docs, not invent flags or silently fall back to PPO.',
    compatibility:
      runtime === 'lab'
        ? 'Legacy Cyclo-Mimic-* remains PPO. Explicit Cyclo-BeyondMimic-* aliases require registration evidence. PPO and SuperMimic checkpoints are incompatible.'
        : 'Current MJLab registers Cyclo-BeyondMimic-K1-Rev1/Rev2-Dance1/Dance2, not legacy Cyclo-Mimic aliases. SuperMimic IDs require -001. Preserve older checkout behavior; never rename checkpoints across methods or robot revisions.',
    artifacts:
      method === 'beyondmimic'
        ? 'For deployment require same-run exported/policy.onnx, params/sim2real.yaml and matching motion CSV; inspect controller semantics separately.'
        : runtime === 'lab'
          ? 'Retain learner/config, robot/joint order, motion digest, timestep, action/observation transforms and representation. Reference motion reuse does not imply ONNX/sim2real policy compatibility. Check local docs for resume/play support.'
          : 'Keep the method-specific ONNX, metadata/notices, matching training params/sim2real.yaml and external motion/goal data together with checkpoint/revision hashes. Reference reuse does not imply ONNX or controller compatibility. Sim2Real guidance is asset review only: verify target controller support for the exact observation/history/action schema, robot revision and rate before any separately authorized deployment; no hardware validation is claimed.',
    evidence:
      'File presence or CLI help establishes interface availability only. Record conversion, optimizer update, checkpoint reload, playback, export and hardware evidence independently. Research smoke does not establish convergence or robot readiness.',
    execution:
      'No local file access, installation, GPU work, network logging or robot access performed.',
    reference: 'skills/ai-sapiens-video-mimic/references/methods.md',
  };
}
