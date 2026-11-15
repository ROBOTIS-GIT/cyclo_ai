# Select a Mimic method

Choose **runtime** (Cyclo Lab or Cyclo MJLab), **physics backend** supported by
that checkout, and **learning method** independently. Existing Cyclo Mimic is
BeyondMimic `whole_body_tracking`-based PPO. SuperMimic learns a differentiable
world model from simulator transitions and trains a policy through imagined
rollouts. A new task name alone does not establish that learner is running.

Reviewed published feature contracts (not a claim about installed/main versions):
[Lab d9ab0766](https://github.com/ROBOTIS-GIT/cyclo_lab/blob/d9ab0766cedade0966b01f85ac65737b8fc48af4/docs/supermimic.md) and
[MJLab bbffabe8](https://github.com/ROBOTIS-GIT/cyclo_mjlab/blob/bbffabe826f149594acfa51789c10e39c249609f/docs/supermimic.md).
SuperMimic implementation authority is only
[official HybridRobotics abc124c1](https://github.com/HybridRobotics/supermimic/tree/abc124c1bd5976341034668af3d12c087f2f1f55);
BeyondMimic is based on [whole_body_tracking](https://github.com/HybridRobotics/whole_body_tracking).
The read-only `cyclo_mimic` MCP returns guidance and checkout requirements; it
neither detects a checkout nor launches jobs.

| Runtime / method | Environment and input | Output and limits |
| --- | --- | --- |
| Lab / BeyondMimic PPO | Branch-pinned Isaac runtime; existing Cyclo NPZ | RSL-RL `model_*.pt`; existing exporter/controller workflow |
| Lab / SuperMimic | Isaac Sim 6.2 / Isaac Lab 3.0 / Python 3.12, native PhysX only; validated named 50 Hz NPZ | `logs/supermimic/<run>/model_<iteration>.pt`, strict v2 checkpoint; no robot export |
| MJLab / BeyondMimic PPO | Existing Python 3.11 / mjlab 1.2; Cyclo body-state NPZ | Existing RSL-RL checkpoint/export contract |
| MJLab / SuperMimic | Locked Python 3.13 / research mjlab 1.6; native MuJoCo, internal reference adapter | `logs/<task>/<timestamp>/` inference bundle; local offline playback; no validated robot export |

Both use `scripts/reinforcement_learning/train.py` and `play.py`, with optional
`--algorithm beyondmimic|supermimic` or recognized task-family inference. Lab uses
`--task`, MJLab a positional task. Preserve backend-specific flags. Legacy
`Cyclo-Mimic-*` IDs remain PPO and `Cyclo-BeyondMimic-*` aliases retain their configs.
Lab's current 6.2 PPO train/play share task IDs; do not append `-Play` for this
revision. Older branches may differ. Historical direct launchers remain valid,
including Lab `mimic.py --method` and MJLab `cyclo-supermimic`.

Lab supports GenCoord K1, privileged `rep_state`, history 1, one clip/encoder,
fixed dynamics and zero context. MaxCoord, proprio/history deployment,
motion-to-velocity latent BC, official return sampling, multi-task/multi-clip and
robot export are not integrated. Its native launcher selects PhysX and rejects
Newton or hidden-dynamics randomization overrides. Do not use an mjlab sidecar.
MJLab supports GenCoord and MaxCoord; default `rep_state` is privileged and the
explicit proprio path lacks a full native acceptance matrix. Its current
MuJoCo-Warp dependencies and collision APIs conflict with legacy PPO; separate
environments are required for this version, not inherently forever.

## Checkout checks and examples

Before generating a command, record commit, branch, dirty state, submodule pins,
Python and actual library versions. Preserve existing work and environments.
Inspect task registration and the command parser before invoking help: some
launchers initialize simulation even for discovery. Use the right environment.
When these feature interfaces are absent, stop with the missing path/task/version
and inspect that branch's documentation; do not install a different learner or
silently train PPO. Compare explicit method and task family before launching.

Use the common selector with `--motion-file` for strict reference validation.
Direct legacy Lab PPO commands retain their historical unnamed-K1 fallback.
Custom registrations must follow the actual runtime's registration pattern.

Only after the paths, tasks and flags are verified in the selected checkout:

```bash
# Lab native integration, from repo root in its pinned Isaac environment:
python scripts/reinforcement_learning/train.py --algorithm supermimic \
  --task Cyclo-SuperMimic-K1-Rev1-Dance1 --motion-file /data/k1_motion.npz \
  --num-envs 2 --iterations 1 --eager --headless
# Local native checkpoint playback (requires compatible saved metadata):
python scripts/reinforcement_learning/play.py --algorithm supermimic \
  --checkpoint logs/supermimic/RUN/model_1.pt --num-envs 1 --play-steps 100 --eager --headless

# MJLab: original supported reference, adapted internally.
WANDB_MODE=offline uv run --project integrations/supermimic python \
  scripts/reinforcement_learning/train.py --algorithm supermimic \
  Cyclo-SuperMimic-GenCoord-K1-Rev1 --motion-file /data/cyclo_motion.npz \
  --num-envs 2 --runner.max-iterations 1 --runner.run-name k1-check
```

These are prepared examples, not executed results or resource guarantees. Initial
compilation and upstream buffers/networks may be costly even for one iteration;
use the checkout's bounded verification recipe and agreed GPU budget. Network
logging, explicit W&B retrieval and a listening viewer need their own authorized scope.
Offline training/playback requires no W&B upload or sync.

## Data, checkpoints and evidence

Preserve source video, retarget CSV, runtime-specific NPZ and deployment CSV.
Lab's native loader reorders named joints to Isaac articulation order and handles
quaternion conventions at its bridge. The Lab selector requires explicit
`quaternion_order` or `quat_order`; the native loader converts to Isaac xyzw,
and the SuperMimic bridge converts root orientation to algorithm wxyz once.
Lab rejects missing/conflicting quaternion conventions rather than guessing.
SuperMimic additionally checks every frame/body against K1 URDF FK and supported
source-defined COM profiles, converting COM twists to link twists in memory.
Both runtimes reject complex arrays and values nonfinite after float32 conversion.
Missing producer/backend labels remain unspecified; physical agreement does not
identify the producer.

MJLab adapts the same original 50 Hz `csv_to_npz` reference internally; a separate
conversion CLI is optional. Verify adapter availability in the selected checkout.
The adapter must validate producer/backend-specific body and joint names and
orders, pelvis/root identity, finite shapes, units, frames, control rate and
quaternion convention. The reviewed MJLab adapter accepts Cyclo/MuJoCo wxyz
world-frame input; it rejects Isaac/xyzw inputs rather than converting backends.
It reorders by validated names. Complete named body-state input is checked
against K1 FK and supported link-origin/current-COM/historical-COM velocity
profiles, including COM-to-origin correction. Legacy producer labels may be
absent only when redundant body states establish the physical convention;
unknown or ambiguous profiles yielding different root velocity fail. Root-only
files require explicit `backend=mujoco`, `quaternion_order=wxyz`,
`velocity_frame=world`, `velocity_point=link_origin`. Never guess from a
23-column shape or unit quaternion norm.
Preserve the original bytes and 50 Hz reference; do not rewrite it in place.
Reference compatibility does not establish ONNX or Sim2Real policy compatibility.
The MJLab adapter uses a derived `.supermimic-data/adapter/` cache and
source-hash/model-signature manifest, revalidating original inputs every call.
This does not establish an unknown producer identity.
Both current K1 integrations require 50 Hz; resample using actual supported converters. Do not relabel a G1 dataset as K1.

PPO checkpoints, Lab checkpoints and MJLab bundles are not interchangeable.
Lab uses `--checkpoint` with `cyclo-supermimic-isaac-v2`: task, motion digest,
physical model, exact timestep/decimation, observations/actions and zero context
must match. v1 files fail. Relocating the same motion is supported; implicit
new-clip warm starts are not. Continuation restores learned/normalizer/optimizer
state into fresh simulator, replay and RNG state, not exact trajectory resume.

MJLab local `--checkpoint-dir` requires `manifest.json`, `world_model.pt`,
`actor.pt` and optional `critic.pt`. The versioned manifest validates task,
representation, actor mode, ordered robot/actions and exact environment timing.
It is an inference bundle, not an optimizer/replay continuation format. Use
exactly one local directory or explicit `--wandb-path`; authenticated retrieval
is untested. Example local playback after validating the saved contract:

```bash
uv run --project integrations/supermimic python scripts/reinforcement_learning/play.py \
  --algorithm supermimic Cyclo-SuperMimic-GenCoord-K1-Rev1 \
  --motion-file /data/cyclo_motion.npz --checkpoint-dir logs/Cyclo-SuperMimic-GenCoord-K1-Rev1/RUN \
  --viewer headless --device cpu --num-steps-rollout 4
```

Published bounded evidence: Lab reports 69 tests, five PhysX WM/actor updates,
exact final learned/optimizer reload, fresh-process update 6, eight inference
steps and one PPO iteration. MJLab reports 274 tests, five native CPU updates
each for GenCoord/Dance1 and MaxCoord/Dance2, final tensor equality, local
reload/play with exact timing and a legacy PPO regression. WM parameters remain
frozen during actor updates while gradients pass through dynamics. These results
are implementation-reported evidence, not runs performed by this plugin or
GitHub CI-green claims for those branches. No convergence, interactive viewer,
robot export, hardware or full-feature-parity claim follows.

Report each stage separately: interface checks; conversion; real simulator
transition; world-model and policy optimizer updates; finite metrics; saved
checkpoint reload; playback; export; Sim2Sim; hardware. A research smoke or a
short learner run does not validate tracking convergence, export or hardware.
This plugin's tests use synthetic evidence and device-free MCP calls only.

Existing PPO deployment requires same-run `exported/policy.onnx`,
`params/sim2real.yaml` and the matching converted motion CSV plus controller
review. For SuperMimic, stop deployment preparation with “No validated K1
export/controller contract for this method and revision.” Preserve artifacts;
never rename an actor checkpoint to ONNX or reuse PPO observation/action config.
