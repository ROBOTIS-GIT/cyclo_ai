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
        'scripts/reinforcement_learning/mimic.py',
        'scripts/reinforcement_learning/supermimic/train.py',
      ],
      task: 'Cyclo-SuperMimic-K1-Rev1-Dance1',
      input:
        'Existing named-joint Cyclo NPZ directly; verify 50 Hz, order and quaternion metadata with the native loader',
      checkpoint: 'logs/supermimic/<run>/model_<iteration>.pt; local native playback',
    },
  },
  mjlab: {
    beyondmimic: {
      learner: 'BeyondMimic whole_body_tracking-based PPO',
      requiredPaths: ['scripts/reinforcement_learning/train.py', 'source/tasks/mimic'],
      task: 'Cyclo-Mimic-K1-Rev1-Dance1',
      input: 'Cyclo body-state motion NPZ; matching deployment motion CSV',
      checkpoint: 'logs/rsl_rl/<experiment>/<run>/model_*.pt',
    },
    supermimic: {
      learner: 'SuperMimic differentiable world model and imagined-rollout policy learner',
      requiredPaths: [
        'source/learning/dispatch.py',
        'source/tasks/supermimic',
        'integrations/supermimic/uv.lock',
        'source/tasks/supermimic/motion.py',
      ],
      task: 'Cyclo-SuperMimic-GenCoord-K1-Rev1 or Cyclo-SuperMimic-MaxCoord-K1-Rev1',
      input:
        'Reuse original 50 Hz csv_to_npz NPZ through the verified internal adapter; validate producer-specific body/joint names, order and quaternion convention. Missing or ambiguous metadata must fail; preserve source.',
      checkpoint:
        'logs/<task>/<timestamp>/; actor.pt, world_model.pt, runner config; W&B bundle playback requires published matching artifacts',
    },
  },
};
export function mimicGuidance({ runtime, method, stage = 'prepare' }) {
  if (!Object.hasOwn(profiles, runtime) || !Object.hasOwn(profiles[runtime], method))
    throw Error('Choose runtime lab or mjlab and method beyondmimic or supermimic');
  if (!['prepare', 'train', 'play', 'export', 'sim2real'].includes(stage))
    throw Error('Unknown Mimic stage');
  if (method === 'supermimic' && ['export', 'sim2real'].includes(stage))
    throw Error(
      'SuperMimic has no validated K1 export/controller contract. Preserve the checkpoint; do not rename it to policy.onnx or reuse PPO sim2real.yaml. Verify a method-specific exporter and controller before deployment.',
    );
  return {
    ...profiles[runtime][method],
    runtime,
    method,
    stage,
    status: 'guidance_only',
    capabilityDetected: false,
    physics:
      runtime === 'lab'
        ? 'Isaac Lab native; inspect branch physics presets. SuperMimic native port currently defaults to PhysX; Newton support is not established.'
        : 'MuJoCo/mjlab; SuperMimic research APIs require a separate environment',
    runtimeCheck:
      runtime === 'lab'
        ? 'Read checkout docs and pinned Isaac Lab/Sim/Python versions. Do not use an mjlab sidecar as Lab support.'
        : method === 'supermimic'
          ? 'Check isolated integrations/supermimic environment: Python 3.13 / mjlab_research 1.6; do not replace PPO Python 3.11 / mjlab 1.2 environment.'
          : 'Check existing PPO environment: Python 3.11 / mjlab 1.2; preserve it.',
    next: 'Record git revision and dirty state; inspect required paths, registrations and actual CLI help in the selected environment. Missing or changed interfaces mean stop and inspect branch docs, not invent flags or silently fall back to PPO.',
    compatibility:
      'Legacy Cyclo-Mimic-* remains PPO. Explicit Cyclo-BeyondMimic-* aliases require registration evidence. PPO and SuperMimic checkpoints are incompatible.',
    artifacts:
      method === 'beyondmimic'
        ? 'For deployment require same-run exported/policy.onnx, params/sim2real.yaml and matching motion CSV; inspect controller semantics separately.'
        : 'Retain learner/config, robot/joint order, motion digest, timestep, action/observation transforms and representation. Reference motion reuse does not imply ONNX/sim2real policy compatibility. Check local docs for resume/play support.',
    evidence:
      'File presence or CLI help establishes interface availability only. Record conversion, optimizer update, checkpoint reload, playback, export and hardware evidence independently. Research smoke does not establish convergence or robot readiness.',
    execution:
      'No local file access, installation, GPU work, network logging or robot access performed.',
    reference: 'skills/ai-sapiens-video-mimic/references/methods.md',
  };
}
