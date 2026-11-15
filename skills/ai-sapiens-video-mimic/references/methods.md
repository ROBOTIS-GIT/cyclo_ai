# Select a Mimic method

Choose **runtime** (Cyclo Lab or Cyclo MJLab), **physics backend** supported by
that checkout, and **learning method** independently. Existing Cyclo Mimic is
BeyondMimic `whole_body_tracking`-based PPO. SuperMimic learns a differentiable
world model from simulator transitions and trains a policy through imagined
rollouts. A new task name alone does not establish that learner is running.

Primary implementation sources: [Cyclo Lab](https://github.com/ROBOTIS-GIT/cyclo_lab),
[Cyclo MJLab](https://github.com/ROBOTIS-GIT/cyclo_mjlab),
[BeyondMimic](https://github.com/HybridRobotics/whole_body_tracking), and
[SuperMimic](https://github.com/HybridRobotics/SuperMimic).
The following describes integration interfaces reviewed on 2026-11-15, including
feature work. It is not a claim that all interfaces are on main or installed.
Inspect the selected revision's `docs/supermimic.md`, implementation and help.
The read-only `cyclo_mimic` MCP tool returns these selection requirements; it
neither detects a checkout nor launches jobs.

| Runtime / method | Environment and input | Train / play interface to verify | Output and limits |
| --- | --- | --- | --- |
| Lab / BeyondMimic PPO | Branch-pinned Isaac Lab and physics; existing Cyclo NPZ | Existing `scripts/reinforcement_learning/rsl_rl/{train,play}.py` | `logs/rsl_rl/<experiment>/<run>/model_*.pt`; existing exporter/controller workflow |
| Lab / SuperMimic | Native Isaac Lab; current port defaults to PhysX, reuses original 50 Hz Cyclo NPZ | `scripts/reinforcement_learning/mimic.py --method supermimic {train,play}` | `logs/supermimic/<run>/model_<iteration>.pt`; native local playback; no validated K1 export/Sim2Real contract |
| MJLab / BeyondMimic PPO | Existing Python 3.11 / mjlab 1.2 environment; Cyclo body-state NPZ | Existing `scripts/reinforcement_learning/{train,play}.py` | Existing RSL-RL checkpoint/export contract |
| MJLab / SuperMimic | Isolated `integrations/supermimic`, Python 3.13 / pinned mjlab_research 1.6; reuse the original 50 Hz Cyclo NPZ through a verified internal adapter | Same native train/play scripts with `--algorithm supermimic`; `cyclo-supermimic` compatibility command | `logs/<task>/<timestamp>/`; `actor.pt`, `world_model.pt`, runner config; W&B bundle playback, offline runs require explicit sync; no validated K1 export/Sim2Real contract |

Do not add mjlab to the Isaac Lab environment or describe an mjlab sidecar as
Lab support. Lab's new native port has a narrower scope: GenCoord, rep-state
actor and one motion encoder; privileged input is not a deployable sensor policy.
MJLab exposes GenCoord and MaxCoord with different representations. Neither
method selection nor a viewer flag selects PhysX versus Newton. Never infer
SuperMimic Newton support from an existing PPO Newton branch.

## Checkout checks and examples

Before generating a command, record commit, branch, dirty state, submodule pins,
Python and actual library versions. Preserve existing work and environments.
Inspect task registration and the command parser before invoking help: some
launchers initialize simulation even for discovery. Use the right environment.
When these feature interfaces are absent, stop with the missing path/task/version
and inspect that branch's documentation; do not install a different learner or
silently train PPO. Compare explicit method and task family before launching.

Legacy `Cyclo-Mimic-K1-Rev1-Dance1` / `Dance2` IDs remain PPO. Where registered,
`Cyclo-BeyondMimic-*` aliases retain those configurations. Lab keeps separate
`-Play` PPO IDs; MJLab uses the same PPO task for train and play. Custom motion
registrations must preserve each runtime's existing registration pattern.

Only after the paths, tasks and flags are verified in the selected checkout:

```bash
# Lab native integration, from repo root in its pinned Isaac environment:
python scripts/reinforcement_learning/mimic.py --method supermimic train \
  --task Cyclo-SuperMimic-K1-Rev1-Dance1 --motion-file /data/k1_motion.npz \
  --num-envs 2 --iterations 1 --headless
# Local native checkpoint playback (requires compatible saved metadata):
python scripts/reinforcement_learning/mimic.py --method supermimic play \
  --checkpoint logs/supermimic/RUN/model_1.pt --num-envs 1 --play-steps 100 --headless

# MJLab integration: verify direct Cyclo NPZ adapter support first.
WANDB_MODE=offline uv run --project integrations/supermimic python \
  scripts/reinforcement_learning/train.py --algorithm supermimic \
  Cyclo-SuperMimic-GenCoord-K1-Rev1 --motion-file /data/cyclo_motion.npz \
  --num-envs 2 --runner.max-iterations 1 --runner.run-name k1-check
```

These are prepared examples, not executed results or resource guarantees. Initial
compilation and upstream buffers/networks may be costly even for one iteration;
use the checkout's bounded verification recipe and agreed GPU budget. Network
logging, W&B sync and a listening viewer need their own authorized scope.

## Data, checkpoints and evidence

Preserve source video, retarget CSV, runtime-specific NPZ and deployment CSV.
Lab's native loader reorders named joints to Isaac articulation order and handles
quaternion conventions at its bridge. MJLab should adapt the same original 50 Hz `csv_to_npz` reference internally;
a separate user conversion CLI is not a required workflow step. Confirm this
capability in the actual branch before using the direct-input example above.
If the adapter is absent or still changing, report the missing capability and
leave execution pending. Do not claim direct input works from a converter alone.
The adapter must validate producer/backend-specific body and joint names and
orders, pelvis/root identity, finite shapes, units, frames, control rate and
quaternion convention (wxyz versus xyzw). It must reorder by validated identity
and convert quaternion convention once, rejecting duplicate, missing or ambiguous
metadata rather than guessing from a 23-column shape or unit quaternion norm.
Preserve the original bytes and 50 Hz reference; do not rewrite it in place.
Reference compatibility does not establish ONNX or Sim2Real policy compatibility.
Both current K1 integrations require 50 Hz;
resample using actual supported converters. Do not relabel a G1 dataset as K1.

PPO checkpoints, Lab SuperMimic checkpoints and MJLab SuperMimic bundles are not
interchangeable. Retain learner config, robot revision, representation, motion
hash, joint order, observation/action transforms and timestep. Lab resume
recollects replay/simulator state; it does not promise exact mid-episode resume.
For MJLab play, verify the matching published W&B bundle and serialized config;
local offline checkpoint existence does not establish viewer availability.

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
