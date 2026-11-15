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
      ],
      task: 'Cyclo-SuperMimic-K1-Rev1-Dance1',
      input:
        'Existing 50 Hz Cyclo NPZ directly; common train/play selector validates unique joint/body names and explicit quaternion_order/quat_order before native articulation reorder and xyzw bridge conversion. SuperMimic validates all frames/bodies against K1 FK and source-defined COM profiles; real arrays must remain finite after float32 conversion. Missing producer/backend labels remain unspecified. Direct legacy PPO launchers retain historical fallback behavior.',
      checkpoint:
        'Use --checkpoint logs/supermimic/<run>/model_<iteration>.pt; strict cyclo-supermimic-isaac-v2 physical/task/motion contract, including exact timestep and decimation. Local playback; continuation restores learned/optimizer state into fresh simulator/replay/RNG, not exact trajectory resume.',
      scope:
        'PhysX only; GenCoord K1, privileged rep_state, history 1, one clip/encoder, fixed dynamics and zero context. No MaxCoord, proprio/history deployment, motion-to-velocity latent BC, official return sampling or multi-task/multi-clip integration.',
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
        'Reuse original 50 Hz Cyclo/MuJoCo csv_to_npz NPZ through the verified internal adapter. Validate complete named body/joint state against K1 FK and supported COM velocity profiles; legacy producer labels may be absent only when physical convention is verified. Root-only files require explicit mujoco/wxyz/world/link_origin metadata. Reject conflicting or ambiguous conventions and Isaac/xyzw inputs; preserve source.',
      scope:
        'Native MuJoCo GenCoord and MaxCoord K1; default rep_state is privileged. Explicit proprio lacks a full native acceptance matrix; no validated robot export.',
      checkpoint:
        'Use --checkpoint-dir logs/<task>/<timestamp>/ containing manifest.json, world_model.pt, actor.pt and optional critic.pt. Validate representation, ordered robot/action contract and exact timestep/decimation. Local offline playback needs no W&B upload/sync. Inference bundle only, not optimizer/replay resume.',
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
    selection:
      'Both runtimes expose scripts/reinforcement_learning/train.py and play.py with optional --algorithm beyondmimic|supermimic or recognized task-family inference; historical aliases/direct launchers remain. Lab uses --task; MJLab uses a positional task. Current Lab 6.2 PPO train/play share task IDs.',
    reviewedRevision:
      runtime === 'lab'
        ? 'd9ab0766cedade0966b01f85ac65737b8fc48af4'
        : 'bbffabe826f149594acfa51789c10e39c249609f',
    status: 'guidance_only',
    capabilityDetected: false,
    physics:
      runtime === 'lab'
        ? 'Isaac Lab native; inspect branch physics presets. SuperMimic native launcher supports PhysX only and rejects Newton overrides.'
        : 'MuJoCo/mjlab; SuperMimic research APIs require a separate environment',
    runtimeCheck:
      runtime === 'lab'
        ? 'Verify native feature checkout pins: Isaac Sim 6.2 / Isaac Lab 3.0 / Python 3.12 for the reviewed SuperMimic port; other branches may differ. Do not use an mjlab sidecar as Lab support.'
        : method === 'supermimic'
          ? 'Check isolated integrations/supermimic environment: Python 3.13 / mjlab_research 1.6; do not replace PPO Python 3.11 / mjlab 1.2 environment; current dependency/API conflicts require separation, not an inherent Python-version impossibility.'
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
