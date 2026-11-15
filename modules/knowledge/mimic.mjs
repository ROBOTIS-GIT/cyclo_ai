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
        'requirements.lock',
        'pyproject.toml',
        'third_party/supermimic/src/supermimic/models.py',
        'source/tasks/supermimic/motion.py',
      ],
      task: 'Cyclo-SuperMimic-GenCoord-K1-Rev1 or Cyclo-SuperMimic-MaxCoord-K1-Rev1',
      input:
        'Reuse original 50 Hz Cyclo/MuJoCo csv_to_npz NPZ through the verified internal adapter. Validate complete named body/joint state against K1 FK and supported COM velocity profiles; legacy producer labels may be absent only when physical convention is verified. Root-only files require explicit mujoco/wxyz/world/link_origin metadata. Reject conflicting or ambiguous conventions and Isaac/xyzw inputs; preserve source.',
      scope:
        'Native MuJoCo GenCoord and MaxCoord K1; default rep_state is privileged. Explicit proprio/history-2 has bounded eager smoke only, not compiled history-mode acceptance; no validated robot export.',
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
        ? '3cbd62592750ee0095df67f54399a0a320164e29'
        : '775c45cecde17ea0551e24de46cd3c62100e6149',
    revisionStatus: 'published',
    acceptance:
      runtime === 'lab'
        ? 'Four bounded backend/representation train/continue/play cells and both BeyondMimic backend regressions reported passed. Lab learner compilation and deployable proprio/history remain unvalidated; no convergence or robot claim.'
        : 'Baseline 1dcc5fa6a0827585656d44009d7d21925e14b122 (documentation follow-up to tested 6e09bf7) production Docker/CUDA PPO/checkpoint/export/EGL checks passed. Integrated Docker suite: 82 tests; GenCoord/MaxCoord CUDA eager and compiled/captured WM/actor updates, exact final save/reload, local playback, installed entry point and fresh-process common playback CLI passed. Proprio/history-2 eager smoke passed; compiled history-mode acceptance and historical trained-policy compatibility are not established.',
    sharedCore:
      'ROBOTIS-GIT/supermimic Git submodule third_party/supermimic at 10dd5dd3f02601caf1991790952a25db63a6fb99, derived from official HybridRobotics abc124c1. Initialize the gitlink and use consumer dependencies; do not install the optional research extra or replace consumer locks with the standalone lock.',
    status: 'guidance_only',
    capabilityDetected: false,
    physics:
      runtime === 'lab'
        ? 'Isaac Lab native; inherited Newton/MJWarp by default or explicit physics=isaacsim_physx. Select --representation gencoord|maxcoord independently. Conflicting physics flags fail; Newton solver num_substeps=1 is distinct from policy decimation; no silent PhysX fallback.'
        : 'Native MuJoCo/stable MJLab; choose GenCoord or MaxCoord by task ID. Keep the Lab and MJLab simulator environments separate even though both use Python 3.12 and the shared core.',
    runtimeCheck:
      runtime === 'lab'
        ? 'Verify native feature checkout pins: Isaac Sim 6.2 / Isaac Lab 3.0 / Python 3.12 for the reviewed SuperMimic port; other branches may differ. Do not use an mjlab sidecar as Lab support.'
        : 'Both algorithms use Python 3.12 / stable MJLab 1.6.1 in the root environment. Follow docs/runtime-migration.md and requirements.lock, then install third_party/supermimic and the consumer editable with --no-deps. integrations/supermimic is optional compatibility, not a required research environment. Preserve unrelated/older environments.',
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
